import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  mapSo1ResponseToCategories,
  validateMappedPredictions,
  getSo1Predictions,
} from '../src/services/so1Adapter.js';
import { SO3_CATEGORIES, SO1_CROP_ALIASES } from '../../shared/config/so1Mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures/so1');

function createMockFetch(resolver) {
  let callCount = 0;
  const calls = [];

  const fn = async (url, options) => {
    calls.push({ url, options });
    const current = Array.isArray(resolver) ? resolver[callCount++] : resolver;
    if (typeof current === 'function') {
      return current(url, options);
    }
    if (current instanceof Error) {
      throw current;
    }
    return current;
  };

  fn.getCalls = () => calls;
  fn.getCallCount = () => calls.length;
  return fn;
}

describe('SO1 Cost Prediction Contract Tests', () => {
  let paddyAnuradhapura;
  let chilliAnuradhapura;
  let tomatoKandy;
  let maizeAnuradhapura;
  let chilliAmpara422;

  beforeAll(() => {
    paddyAnuradhapura = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Paddy_Anuradhapura_Maha_Irrigated.json'), 'utf8')
    );
    chilliAnuradhapura = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Green_Chilli_Anuradhapura_Maha_Irrigated.json'), 'utf8')
    );
    tomatoKandy = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Tomato_Kandy_Maha_Irrigated.json'), 'utf8')
    );
    maizeAnuradhapura = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Maize_Anuradhapura_Maha_Irrigated.json'), 'utf8')
    );
    chilliAmpara422 = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Green_Chilli_Ampara_Maha_Irrigated_422.json'), 'utf8')
    );
  });

  describe('1. Mapping against Real Fixtures', () => {
    test('maps Paddy fixture into exactly 8 SO3 categories with valid ranges', () => {
      const result = mapSo1ResponseToCategories(paddyAnuradhapura, 1.0);
      expect(result.categories).toHaveLength(8);

      const catNames = result.categories.map(c => c.category);
      expect(catNames).toEqual(expect.arrayContaining(SO3_CATEGORIES));

      // Direct categories must not have is_estimated_split
      const direct = ['seed', 'fertilizer', 'labour', 'irrigation'];
      const split = ['machinery', 'fuel', 'agrochemical', 'other'];

      for (const cat of result.categories) {
        expect(Number.isInteger(cat.expected)).toBe(true);
        expect(Number.isInteger(cat.low)).toBe(true);
        expect(Number.isInteger(cat.high)).toBe(true);
        expect(cat.expected).toBeGreaterThanOrEqual(0);
        expect(cat.low).toBeLessThanOrEqual(cat.expected);
        expect(cat.high).toBeGreaterThanOrEqual(cat.expected);

        if (direct.includes(cat.category)) {
          expect(cat.is_estimated_split).toBe(false);
        }
        if (split.includes(cat.category)) {
          expect(cat.is_estimated_split).toBe(true);
        }
      }
    });

    test('maps Green Chilli, Tomato, and Maize real fixtures cleanly', () => {
      for (const fixture of [chilliAnuradhapura, tomatoKandy, maizeAnuradhapura]) {
        const result = mapSo1ResponseToCategories(fixture, 1.0);
        expect(result.categories).toHaveLength(8);
        expect(validateMappedPredictions(result.categories, result.totalTarget)).toBe(true);
      }
    });
  });

  describe('2. Rounding Sum Exactness (Largest-Remainder Hare-Niemeyer)', () => {
    test('sum of category integer LKR matches totalTarget exactly for real fixtures', () => {
      const fixtures = [paddyAnuradhapura, chilliAnuradhapura, tomatoKandy, maizeAnuradhapura];
      for (const fix of fixtures) {
        const result = mapSo1ResponseToCategories(fix, 1.0);
        const sumCategories = result.categories.reduce((acc, c) => acc + c.expected, 0);
        expect(sumCategories).toBe(result.totalTarget);
      }
    });

    test('invariant holds across various fractional acreages (0.33, 0.75, 1.25, 2.718, 5.0)', () => {
      const testAcres = [0.33, 0.5, 0.75, 1.25, 1.5, 2.33, 2.718, 5.0, 10.0];
      for (const acres of testAcres) {
        const result = mapSo1ResponseToCategories(chilliAnuradhapura, acres);
        const sumCategories = result.categories.reduce((acc, c) => acc + c.expected, 0);
        expect(sumCategories).toBe(result.totalTarget);
        expect(sumCategories).toBe(Math.round(chilliAnuradhapura.predicted_cost * acres));
      }
    });
  });

  describe('3. Hand-Computed Acreage Scaling', () => {
    test('scales Paddy Anuradhapura Maha to 2.0 acres matching hand calculations', () => {
      const rawCost = paddyAnuradhapura.predicted_cost; // 143523.1
      const rawLow = paddyAnuradhapura.interval_low;     // 118869.6
      const rawHigh = paddyAnuradhapura.interval_high;   // 173289.6

      const expectedTotal = Math.round(rawCost * 2.0);   // 287046
      const expectedLow = Math.round(rawLow * 2.0);       // 237739
      const expectedHigh = Math.round(rawHigh * 2.0);     // 346579

      const result = mapSo1ResponseToCategories(paddyAnuradhapura, 2.0);

      expect(result.totalTarget).toBe(287046);
      expect(result.totalTarget).toBe(expectedTotal);
      expect(result.intervalLow).toBe(237739);
      expect(result.intervalLow).toBe(expectedLow);
      expect(result.intervalHigh).toBe(346579);
      expect(result.intervalHigh).toBe(expectedHigh);

      const sumCategories = result.categories.reduce((acc, c) => acc + c.expected, 0);
      expect(sumCategories).toBe(287046);
    });
  });

  describe('4. Crop Alias Resolution', () => {
    test('resolves "Chili" alias to "Green Chilli" in getSo1Predictions', async () => {
      let requestedCrop = null;
      const mockFetch = createMockFetch((url, options) => {
        const body = JSON.parse(options.body);
        requestedCrop = body.crop;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(chilliAnuradhapura),
        };
      });

      const res = await getSo1Predictions({
        crop: 'Chili',
        district: 'Anuradhapura',
        season: 'Maha',
        irrigation: 'Irrigated',
        acres: 1.0,
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(requestedCrop).toBe('Green Chilli');
    });

    test('preserves recognized crops directly', () => {
      expect(SO1_CROP_ALIASES['Chili']).toBe('Green Chilli');
      expect(SO1_CROP_ALIASES['chili']).toBe('Green Chilli');
      expect(SO1_CROP_ALIASES['Green Chili']).toBe('Green Chilli');
      expect(SO1_CROP_ALIASES['Paddy']).toBe('Paddy');
    });
  });

  describe('5. District Fallback Order (exact -> whole_island -> extrapolated)', () => {
    test('uses exact district when empirical record exists', async () => {
      const mockFetch = createMockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve(paddyAnuradhapura),
      });

      const res = await getSo1Predictions({
        crop: 'Paddy',
        district: 'Anuradhapura',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(res.metadata.district_policy_used).toBe('exact');
      expect(res.metadata.low_confidence).toBe(false);
      expect(mockFetch.getCallCount()).toBe(1);
    });

    test('falls back to "Whole Island" when exact district returns 422', async () => {
      const wholeIslandData = { ...paddyAnuradhapura, request_id: 'wi-req-1' };
      const mockFetch = createMockFetch([
        {
          ok: false,
          status: 422,
          json: () => Promise.resolve({ detail: 'No empirical DoA data for Paddy in Galle' }),
        },
        {
          ok: true,
          status: 200,
          json: () => Promise.resolve(wholeIslandData),
        },
      ]);

      const res = await getSo1Predictions({
        crop: 'Paddy',
        district: 'Galle',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(res.metadata.district_policy_used).toBe('whole_island');
      expect(mockFetch.getCallCount()).toBe(2);
    });

    test('falls back to extrapolation when both exact district and Whole Island fail', async () => {
      const extrapolatedData = {
        ...chilliAnuradhapura,
        low_confidence: true,
        warning: 'Extrapolated baseline: No direct DoA record',
      };

      const mockFetch = createMockFetch([
        {
          ok: false,
          status: 422,
          json: () => Promise.resolve({ detail: 'No empirical data' }),
        },
        {
          ok: false,
          status: 422,
          json: () => Promise.resolve({ detail: 'Whole island not available' }),
        },
        {
          ok: true,
          status: 200,
          json: () => Promise.resolve(extrapolatedData),
        },
      ]);

      const res = await getSo1Predictions({
        crop: 'Green Chilli',
        district: 'Galle',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(res.metadata.district_policy_used).toBe('extrapolated');
      expect(res.metadata.low_confidence).toBe(true);
      expect(mockFetch.getCallCount()).toBe(3);
    });

    test('marks baselineStatus="missing" if all 3 policies fail', async () => {
      const mockFetch = createMockFetch({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ detail: 'Cannot predict' }),
      });

      const res = await getSo1Predictions({
        crop: 'Green Chilli',
        district: 'UnknownDistrict',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(false);
      expect(res.baselineStatus).toBe('missing');
    });
  });

  describe('6. 422 Unprocessable Entity Handling', () => {
    test('real 422 fixture is properly parsed and does not crash the service', async () => {
      const mockFetch = createMockFetch({
        ok: false,
        status: 422,
        json: () => Promise.resolve(chilliAmpara422),
      });

      const res = await getSo1Predictions({
        crop: 'Green Chilli',
        district: 'Ampara',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(false);
      expect(res.baselineStatus).toBe('missing');
      expect(res.error).toBeDefined();
    });
  });

  describe('7. Timeout Handling', () => {
    test('handles timeout abort gracefully without hanging or unhandled rejection', async () => {
      const mockFetch = createMockFetch(new Error('The operation was aborted due to timeout'));

      const res = await getSo1Predictions({
        crop: 'Paddy',
        district: 'Anuradhapura',
        fetchFn: mockFetch,
        timeoutMs: 10,
      });

      expect(res.success).toBe(false);
      expect(res.baselineStatus).toBe('missing');
      expect(res.error).toMatch(/aborted|timeout/i);
    });
  });

  describe('8. Bad Shape Rejection', () => {
    test('rejects response missing predicted_cost or non-finite values', () => {
      expect(() => {
        mapSo1ResponseToCategories({ ...paddyAnuradhapura, predicted_cost: null });
      }).toThrow(/Invalid predicted_cost/);

      expect(() => {
        mapSo1ResponseToCategories({ ...paddyAnuradhapura, predicted_cost: -500 });
      }).toThrow(/Invalid predicted_cost/);

      expect(() => {
        mapSo1ResponseToCategories({ ...paddyAnuradhapura, cost_breakdown: {} });
      }).toThrow(/breakdown sum is zero/);
    });

    test('validateMappedPredictions throws if array length !== 8 or sum !== totalTarget', () => {
      const valid = mapSo1ResponseToCategories(paddyAnuradhapura, 1.0).categories;

      // Length violation
      expect(() => {
        validateMappedPredictions(valid.slice(0, 7), 100);
      }).toThrow(/Predictions must be an array of exactly 8 categories/);

      // Sum invariant violation
      expect(() => {
        validateMappedPredictions(valid, 9999999);
      }).toThrow(/Largest-remainder sum invariant failed/);

      // Range violation (low > expected)
      const corrupted = JSON.parse(JSON.stringify(valid));
      corrupted[0].low = corrupted[0].expected + 100;
      expect(() => {
        validateMappedPredictions(corrupted);
      }).toThrow(/Range violation/);
    });
  });

  describe('9. Unsupported Parameters', () => {
    test('returns missing baseline status when SO1 service rejects unsupported crop', async () => {
      const mockFetch = createMockFetch({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Unsupported crop: Dragonfruit' }),
      });

      const res = await getSo1Predictions({
        crop: 'Dragonfruit',
        district: 'Kandy',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(false);
      expect(res.baselineStatus).toBe('missing');
    });
  });

  describe('10. Warning Serialization and Deduplication', () => {
    test('serializes 422 object detail, avoids [object Object], and deduplicates warnings', async () => {
      const object422Detail = [
        {
          type: 'value_error',
          loc: ['body', 'district'],
          msg: "Value error, District 'Galle' is not supported.",
          input: 'Galle',
        },
      ];

      const successDataWithDuplicateWarnings = {
        ...chilliAnuradhapura,
        warning: 'Duplicate warning note',
        low_confidence_reason: 'Duplicate warning note',
      };

      const mockFetch = createMockFetch([
        // Attempt 1: Exact district returns 422 with an array/object detail
        {
          ok: false,
          status: 422,
          json: () => Promise.resolve({ detail: object422Detail }),
        },
        // Attempt 2: Whole Island returns 422 with another object detail
        {
          ok: false,
          status: 422,
          json: () => Promise.resolve({ detail: { error: 'Whole Island unavailable' } }),
        },
        // Attempt 3: Extrapolation returns 200 with identical warning and low_confidence_reason
        {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successDataWithDuplicateWarnings),
        },
      ]);

      const res = await getSo1Predictions({
        crop: 'Green Chilli',
        district: 'Galle',
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(res.metadata.warnings).toBeDefined();
      expect(res.metadata.warnings.length).toBeGreaterThan(0);

      // Assert no warning contains '[object Object]'
      for (const w of res.metadata.warnings) {
        expect(typeof w).toBe('string');
        expect(w).not.toContain('[object Object]');
      }

      // Assert that the object detail was serialized as JSON
      expect(res.metadata.warnings[0]).toContain("Value error, District 'Galle' is not supported.");

      // Assert no duplicate warnings
      const set = new Set(res.metadata.warnings);
      expect(set.size).toBe(res.metadata.warnings.length);

      // Verify 'Duplicate warning note' appears exactly once
      const dupeCount = res.metadata.warnings.filter(w => w === 'Duplicate warning note').length;
      expect(dupeCount).toBe(1);
    });
  });
});

