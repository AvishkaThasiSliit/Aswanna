import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { computeCropRanking } from '../../shared/ranking.js';
import { CropAccuracyHistory } from '../src/models/CropAccuracyHistory.js';
import { Cycle } from '../src/models/Cycle.js';
import { transitionCycle } from '../src/services/cycleService.js';
import {
  getCropRecommendations,
  clearRecommendationCache,
} from '../src/services/recommendationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures/so1');

const paddyFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'Paddy_Anuradhapura_Maha_Irrigated.json'), 'utf8')
);
const maizeFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'Maize_Anuradhapura_Maha_Irrigated.json'), 'utf8')
);
const chilliFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'Green_Chilli_Anuradhapura_Maha_Irrigated.json'), 'utf8')
);
const tomato422Fixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'Tomato_Anuradhapura_Maha_Irrigated_422.json'), 'utf8')
);

describe('SO3.5 Crop Recommendation Unit & Integration Tests', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Farmer',
        email: `rec-test-${Date.now()}-${Math.random()}@aswanna.lk`,
        password: 'Password123',
        district: 'Kurunegala',
        phone: '0779998888',
      });
    token = res.body.token;
    userId = res.body.user._id;
  });

  // ── 1. Pure Function Formula & Arithmetic Fixtures ─────────────────────────
  describe('Pure Ranking Function (shared/ranking.js)', () => {
    it('shrinkage formula with n = 0 uses prior error fallback (cold start)', () => {
      const candidates = [{ crop: 'Tomato', predictedCost: 245000 }];
      const historyMap = {}; // n = 0
      const ranked = computeCropRanking(candidates, historyMap, { k: 3, priorError: 0.15, penalty: 2.0 });

      expect(ranked[0].coldStart).toBe(true);
      expect(ranked[0].sampleSize).toBe(0);
      expect(ranked[0].shrunkError).toBe(0.15); // (0 + 3 * 0.15) / 3 = 0.15
      expect(ranked[0].reliability).toBe(0.85); // 1 - 0.15 = 0.85
    });

    it('shrinkage formula with n = 1 calculates weighted shrunk error', () => {
      const candidates = [{ crop: 'Tomato', predictedCost: 245000 }];
      const historyMap = { Tomato: [0.45] }; // n = 1, meanError = 0.45
      const ranked = computeCropRanking(candidates, historyMap, { k: 3, priorError: 0.15, penalty: 2.0 });

      // shrunkError = (1 * 0.45 + 3 * 0.15) / 4 = (0.45 + 0.45) / 4 = 0.225
      expect(ranked[0].sampleSize).toBe(1);
      expect(ranked[0].shrunkError).toBe(0.225);
      expect(ranked[0].reliability).toBe(0.775); // 1 - 0.225 = 0.775
    });

    it('shrinkage formula with n = 10 relies heavily on historical data', () => {
      const candidates = [{ crop: 'Tomato', predictedCost: 245000 }];
      const historyMap = { Tomato: Array(10).fill(0.10) }; // n = 10, meanError = 0.10
      const ranked = computeCropRanking(candidates, historyMap, { k: 3, priorError: 0.15, penalty: 2.0 });

      // shrunkError = (10 * 0.10 + 3 * 0.15) / 13 = (1.0 + 0.45) / 13 ≈ 0.1115
      expect(ranked[0].sampleSize).toBe(10);
      expect(ranked[0].shrunkError).toBeCloseTo(0.1115, 3);
    });

    it('determinism: running twice produces identical ranking output', () => {
      const candidates = [
        { crop: 'Paddy', predictedCost: 220000 },
        { crop: 'Tomato', predictedCost: 245000 },
        { crop: 'Maize', predictedCost: 162000 },
      ];
      const historyMap = {
        Tomato: [0.45, 0.43, 0.47],
        Maize: [0.02, 0.02, 0.02],
        Paddy: [0.01, 0.01, 0.01],
      };

      const run1 = computeCropRanking(candidates, historyMap);
      const run2 = computeCropRanking(candidates, historyMap);

      expect(run1).toEqual(run2);
    });

    it('tie-break: identical score breaks ties alphabetically by crop name', () => {
      const candidates = [
        { crop: 'Tomato', predictedCost: 350000 }, // yield 3500 => cost/unit = 100
        { crop: 'Maize', predictedCost: 180000 },  // yield 1800 => cost/unit = 100
      ];
      // Force identical history => identical score
      const historyMap = { Maize: [0.10], Tomato: [0.10] };
      const ranked = computeCropRanking(candidates, historyMap);

      expect(ranked[0].crop).toBe('Maize');
      expect(ranked[1].crop).toBe('Tomato');
    });

    it('stability: no ranking flip occurs without data changes', () => {
      const candidates = [
        { crop: 'Maize', predictedCost: 162000 },
        { crop: 'Tomato', predictedCost: 245000 },
      ];
      const historyMap = { Tomato: [0.40], Maize: [0.05] };

      const initialRank = computeCropRanking(candidates, historyMap).map(r => r.crop);
      const secondRank = computeCropRanking(candidates, historyMap).map(r => r.crop);

      expect(initialRank).toEqual(secondRank);
    });
  });

  // ── 2. Server API & Cycle-Close Idempotency ────────────────────────────────
  describe('GET /api/crop-recommendation & Cycle-Close Handler', () => {
    it('GET /api/crop-recommendation returns ranked crops with baseline comparison', async () => {
      const res = await request(app)
        .get('/api/crop-recommendation?district=Kurunegala&season=Yala')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBeGreaterThan(0);

      const first = res.body.items[0];
      expect(first).toHaveProperty('crop');
      expect(first).toHaveProperty('predictedCost');
      expect(first).toHaveProperty('costEfficiency');
      expect(first).toHaveProperty('expectedYield');
      expect(first).toHaveProperty('reliability');
      expect(first).toHaveProperty('sampleSize');
      expect(first).toHaveProperty('costOnlyRank');
      expect(first).toHaveProperty('accuracyRank');
      expect(first).toHaveProperty('plainLanguageReason');
    });

    it('cycle transition to closed creates CropAccuracyHistory once (idempotent)', async () => {
      const cycle = await Cycle.create({
        farmerId: new mongoose.Types.ObjectId().toString(),
        crop: 'Tomato',
        season: 'Yala',
        district: 'Kurunegala',
        startDate: '2026-04-01',
        status: 'draft',
      });
      const cycleId = cycle._id.toString();

      await transitionCycle(cycleId, 'active', userId);
      await transitionCycle(cycleId, 'harvesting', userId);
      await transitionCycle(cycleId, 'closed', userId);

      const historyCount1 = await CropAccuracyHistory.countDocuments({ cycleId });
      expect(historyCount1).toBe(1);

      // Attempt second closed transition logic trigger (idempotent check)
      await transitionCycle(cycleId, 'closed', userId).catch(() => null);
      const historyCount2 = await CropAccuracyHistory.countDocuments({ cycleId });
      expect(historyCount2).toBe(1);
    });
  });

  // ── 3. SO1 Real Adapter Contract Integration & Hand-Calculated Ranking ─────
  describe('3. SO1 Real Adapter Contract Integration & Hand-Calculated Ranking', () => {
    beforeEach(() => {
      clearRecommendationCache();
    });

    /**
     * HAND-CALCULATION VERIFICATION:
     * District: Anuradhapura, Season: Maha, Irrigation: Irrigated, Extent: 1 Acre
     *
     * 1. Real SO1 Fixture Predicted Costs:
     *    - Paddy: 143,523.1 LKR -> 143,523 LKR
     *    - Maize: 148,223.2 LKR -> 148,223 LKR
     *    - Chili (Green Chilli): 428,806.5 LKR -> 428,807 LKR
     *    - Tomato: Returns HTTP 422 (Zero historical survey records in Anuradhapura)
     *
     * 2. Benchmark Expected Yields (shared/config/cropYields.js):
     *    - Paddy: 2,200 kg/acre
     *    - Maize: 1,800 kg/acre
     *    - Chili: 1,200 kg/acre
     *
     * 3. Cost Efficiency (predictedCost / expectedYield in LKR/kg):
     *    - Paddy: 143,523 / 2,200 = 65.2377... LKR/kg -> 65.24 LKR/kg
     *    - Maize: 148,223 / 1,800 = 82.3461... LKR/kg -> 82.35 LKR/kg
     *    - Chili: 428,807 / 1,200 = 357.3391... LKR/kg -> 357.34 LKR/kg
     *
     * 4. Cold-Start Shrinkage (n = 0, k = 3, priorError = 0.15, penalty = 2.0):
     *    - shrunkError = (0 + 3 * 0.15) / 3 = 0.15 (15%)
     *    - reliability = 1 - 0.15 = 0.85 (85%)
     *    - score = costEfficiency * (1 + 2.0 * 0.15) = costEfficiency * 1.30
     *      - Paddy score: 65.2377 * 1.30 = 84.8090
     *      - Maize score: 82.3461 * 1.30 = 107.0500
     *      - Chili score: 357.3391 * 1.30 = 464.5409
     *
     * 5. Hand-Computed Ranking Order:
     *    - #1 Paddy (costEfficiency: 65.24, score: 84.8090)
     *    - #2 Maize (costEfficiency: 82.35, score: 107.0500)
     *    - #3 Chili (costEfficiency: 357.34, score: 464.5409)
     *    - Unavailable: Tomato (Reason: HTTP 422)
     */
    it('ranks crops using real SO1 fixtures with order recomputed by hand and moves failed crop to unavailable', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        const mockFetch = async (url, options) => {
          const body = JSON.parse(options.body);
          if (body.crop === 'Paddy') {
            return { ok: true, status: 200, json: async () => paddyFixture };
          }
          if (body.crop === 'Maize') {
            return { ok: true, status: 200, json: async () => maizeFixture };
          }
          if (body.crop === 'Green Chilli') {
            return { ok: true, status: 200, json: async () => chilliFixture };
          }
          if (body.crop === 'Tomato') {
            return { ok: false, status: 422, json: async () => tomato422Fixture };
          }
          return { ok: false, status: 404, json: async () => ({ detail: 'Not found' }) };
        };

        const res = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: mockFetch,
        });

        // 1. Verify items array contains exactly the 3 successful crops
        expect(res.items).toHaveLength(3);
        const rankedCrops = res.items.map(i => i.crop);
        expect(rankedCrops).toEqual(['Paddy', 'Maize', 'Chili']);

        // 2. Hand-computed values match exactly
        const paddy = res.items[0];
        expect(paddy.crop).toBe('Paddy');
        expect(paddy.predictedCost).toBe(143523);
        expect(paddy.costEfficiency).toBe(65.24);
        expect(paddy.accuracyRank).toBe(1);
        expect(paddy.costOnlyRank).toBe(1);
        expect(paddy.intervalLow).toBeDefined();
        expect(paddy.intervalHigh).toBeDefined();
        expect(paddy.dataQuality).toBe('observed');

        const maize = res.items[1];
        expect(maize.crop).toBe('Maize');
        expect(maize.predictedCost).toBe(148223);
        expect(maize.costEfficiency).toBe(82.35);
        expect(maize.accuracyRank).toBe(2);
        expect(maize.costOnlyRank).toBe(2);

        const chili = res.items[2];
        expect(chili.crop).toBe('Chili');
        expect(chili.predictedCost).toBe(428807);
        expect(chili.costEfficiency).toBe(357.34);
        expect(chili.accuracyRank).toBe(3);
        expect(chili.costOnlyRank).toBe(3);

        // 3. Verify Tomato was excluded from ranking and returned in unavailable list
        expect(res.unavailable).toHaveLength(1);
        expect(res.unavailable[0].crop).toBe('Tomato');
        expect(res.unavailable[0].reason).toContain('Tomato in Anuradhapura');
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('in-memory cache prevents redundant SO1 network calls on repeated requests', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        let callCount = 0;
        const countingFetch = async (url, options) => {
          callCount++;
          const body = JSON.parse(options.body);
          if (body.crop === 'Paddy') return { ok: true, status: 200, json: async () => paddyFixture };
          if (body.crop === 'Maize') return { ok: true, status: 200, json: async () => maizeFixture };
          if (body.crop === 'Green Chilli') return { ok: true, status: 200, json: async () => chilliFixture };
          return { ok: false, status: 422, json: async () => tomato422Fixture };
        };

        // First call populates cache
        const res1 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: countingFetch,
        });
        expect(callCount).toBeGreaterThan(0);
        const firstCallCount = callCount;

        // Second identical call hits cache
        const res2 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: countingFetch,
        });
        expect(callCount).toBe(firstCallCount); // No new network calls made
        expect(res2.items.map(i => i.crop)).toEqual(res1.items.map(i => i.crop));
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('mock mode preserves hardcoded benchmark totals and returns empty unavailable list', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'mock';

      try {
        const res = await getCropRecommendations('Kurunegala', 'Yala', 'Unspecified');

        expect(res.items).toHaveLength(4);
        expect(res.unavailable).toHaveLength(0);

        const cropsMap = Object.fromEntries(res.items.map(i => [i.crop, i.predictedCost]));
        expect(cropsMap.Paddy).toBe(220000);
        expect(cropsMap.Maize).toBe(162000);
        expect(cropsMap.Tomato).toBe(245000);
        expect(cropsMap.Chili).toBe(132000);
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('GET /api/crop-recommendation integrates irrigation parameter and returns items and unavailable lists', async () => {
      const res = await request(app)
        .get('/api/crop-recommendation?district=Kurunegala&season=Yala&irrigation=Irrigated')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('district', 'Kurunegala');
      expect(res.body).toHaveProperty('season', 'Yala');
      expect(res.body).toHaveProperty('irrigation', 'Irrigated');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('unavailable');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(Array.isArray(res.body.unavailable)).toBe(true);
    });
  });

  // ── 4. In-Memory Caching & Error TTL (Fake Timers) ─────────────────────────
  describe('In-Memory Caching & Error TTL with Fake Timers', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      clearRecommendationCache();
    });

    afterEach(() => {
      jest.useRealTimers();
      clearRecommendationCache();
    });

    it('(a) SO1 down then back up within the same test: next request after the short TTL succeeds and ranks the crop', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        let isSo1Up = false;
        let callCount = 0;

        const dynamicFetch = async (url, options) => {
          callCount++;
          if (!isSo1Up) {
            // SO1 is down: returns 503 Service Unavailable (5xx error)
            return {
              ok: false,
              status: 503,
              statusText: 'Service Unavailable',
              json: async () => ({ detail: 'SO1 service temporarily down' }),
            };
          }
          // SO1 is up: returns valid predictions
          const body = JSON.parse(options.body);
          if (body.crop === 'Paddy') return { ok: true, status: 200, json: async () => paddyFixture };
          if (body.crop === 'Maize') return { ok: true, status: 200, json: async () => maizeFixture };
          if (body.crop === 'Green Chilli') return { ok: true, status: 200, json: async () => chilliFixture };
          return { ok: false, status: 422, json: async () => tomato422Fixture };
        };

        // 1. Initial request with SO1 down
        const res1 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: dynamicFetch,
        });

        expect(res1.items).toHaveLength(0);
        expect(res1.unavailable).toHaveLength(4);
        const callsAfterFail = callCount;
        expect(callsAfterFail).toBeGreaterThan(0);

        // 2. SO1 comes back up
        isSo1Up = true;

        // 3. Request within short TTL (10s < 30s): served from cache, no new SO1 calls
        jest.advanceTimersByTime(10 * 1000);
        const resCached = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: dynamicFetch,
        });
        expect(callCount).toBe(callsAfterFail); // No network calls made
        expect(resCached.items).toHaveLength(0);
        expect(resCached.unavailable).toHaveLength(4);

        // 4. Advance past the short TTL (30s default; advance by another 25s, total 35s > 30s)
        jest.advanceTimersByTime(25 * 1000);

        // 5. Next request after short TTL: cache has expired, calls SO1, succeeds and ranks the crops
        const res2 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: dynamicFetch,
        });

        expect(callCount).toBeGreaterThan(callsAfterFail);
        expect(res2.items.length).toBeGreaterThanOrEqual(3);
        expect(res2.items[0].crop).toBe('Paddy');
        expect(res2.items[0].predictedCost).toBe(143523);
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('(b) a successful result is still served from cache without a second SO1 call', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        let callCount = 0;
        const countingFetch = async (url, options) => {
          callCount++;
          const body = JSON.parse(options.body);
          if (body.crop === 'Paddy') return { ok: true, status: 200, json: async () => paddyFixture };
          if (body.crop === 'Maize') return { ok: true, status: 200, json: async () => maizeFixture };
          if (body.crop === 'Green Chilli') return { ok: true, status: 200, json: async () => chilliFixture };
          return { ok: false, status: 422, json: async () => tomato422Fixture };
        };

        // First call populates cache with 24h TTL
        const res1 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: countingFetch,
        });
        expect(res1.items).toHaveLength(3);
        const callsAfterFirst = callCount;

        // Advance timers by 2 hours (well within 24h TTL)
        jest.advanceTimersByTime(2 * 60 * 60 * 1000);

        // Second call: served from cache without a second SO1 call
        const res2 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: countingFetch,
        });
        expect(callCount).toBe(callsAfterFirst); // Zero new network calls
        expect(res2.items.map(i => i.crop)).toEqual(res1.items.map(i => i.crop));
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('(c) a 422 result stays cached', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        let callCount = 0;
        const deterministic422Fetch = async () => {
          callCount++;
          return {
            ok: false,
            status: 422,
            json: async () => tomato422Fixture,
          };
        };

        // First call fails with 422 for all crops
        const res1 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: deterministic422Fetch,
        });
        expect(res1.unavailable).toHaveLength(4);
        const callsAfterFirst = callCount;

        // Advance timers past the 30s short error TTL (5 minutes = 300,000 ms)
        jest.advanceTimersByTime(5 * 60 * 1000);

        // Second call: 422 result is deterministic and stays cached (up to 24h)
        const res2 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: deterministic422Fetch,
        });
        expect(callCount).toBe(callsAfterFirst); // Zero new calls made, stays cached!
        expect(res2.unavailable).toHaveLength(4);
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });

    it('connection errors and timeouts are not cached at all (TTL = 0)', async () => {
      const origMode = process.env.SO1_MODE;
      process.env.SO1_MODE = 'real';

      try {
        let callCount = 0;
        const connErrFetch = async () => {
          callCount++;
          const err = new TypeError('fetch failed');
          err.cause = { code: 'ECONNREFUSED' };
          throw err;
        };

        const res1 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: connErrFetch,
        });
        expect(res1.unavailable).toHaveLength(4);
        const callsAfterFirst = callCount;

        // Immediately call again without advancing time - must NOT be cached
        const res2 = await getCropRecommendations('Anuradhapura', 'Maha', 'Irrigated', {
          fetchFn: connErrFetch,
        });
        expect(callCount).toBeGreaterThan(callsAfterFirst);
      } finally {
        process.env.SO1_MODE = origMode;
      }
    });
  });
});

