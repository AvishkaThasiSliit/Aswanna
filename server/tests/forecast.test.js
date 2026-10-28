/**
 * server/tests/forecast.test.js
 *
 * Comprehensive End-of-Season Cost Forecasting Test Suite.
 *
 * Covers:
 *   1. Hand-computed forecasts (tau=0.30, 0.50, 0.80) & interpolation.
 *   2. Minimum progress rules (too_early at tau=0.10 for prior, tau=0.15 for learned).
 *   3. Insufficient data guards (unsupported crops, zero baseline, missing baseline).
 *   4. 5 golden Python-vs-JS parity cases (< 10^-6 relative error).
 *   5. API Integration:
 *      - Mode 'off' returns HTTP 404.
 *      - Owner isolation returns HTTP 403 for unauthorized users.
 *      - Mode 'prior' returns 200 with prior ratio projection.
 *      - Mode 'learned' switches dynamically: n < 5 falls back to prior; n >= 5 uses learned.
 *      - Advisory only: asserts 0 Alert documents are created in DB.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { ENV } from '../src/config/env.js';
import {
  interpolateCurve,
  findNearestTauKey,
  computeExpectedFraction,
  computeForecastFromValues,
  computeForecastForCycle,
} from '../src/services/forecastService.js';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { Cycle } from '../src/models/Cycle.js';
import { Baseline } from '../src/models/Baseline.js';
import { Expense } from '../src/models/Expense.js';
import { Alert } from '../src/models/Alert.js';
import { ActivityCode } from '../src/models/ActivityCode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sharedConfigDir = path.resolve(__dirname, '../../shared/config');
const priorsConfig = JSON.parse(fs.readFileSync(path.join(sharedConfigDir, 'phasingPriors.json'), 'utf8'));
const conformalConfig = JSON.parse(fs.readFileSync(path.join(sharedConfigDir, 'conformalQuantiles.json'), 'utf8'));

describe('1. Hand-Computed Forecasts & Curve Interpolation', () => {
  const KNOTS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const linearValues = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  test('interpolateCurve correctly evaluates exact knots and intermediate points', () => {
    expect(interpolateCurve(KNOTS, linearValues, 0.0)).toBe(0.0);
    expect(interpolateCurve(KNOTS, linearValues, 0.35)).toBeCloseTo(0.35, 6);
    expect(interpolateCurve(KNOTS, linearValues, 1.0)).toBe(1.0);
    // Boundary clamping
    expect(interpolateCurve(KNOTS, linearValues, -0.2)).toBe(0.0);
    expect(interpolateCurve(KNOTS, linearValues, 1.5)).toBe(1.0);
  });

  test('findNearestTauKey maps tau to closest evaluated knot', () => {
    expect(findNearestTauKey(0.28)).toBe('0.30');
    expect(findNearestTauKey(0.52)).toBe('0.50');
    expect(findNearestTauKey(0.81)).toBe('0.80');
    expect(findNearestTauKey(0.05)).toBe('0.10');
  });

  test('hand-computed fixture 1: Paddy, tau=0.30, equal baseline shares, spend=30,000 -> forecast=80,743 LKR', () => {
    const categoryBaselines = {
      seed: 12500, fertilizer: 12500, agrochemical: 12500, labour: 12500,
      machinery: 12500, fuel: 12500, irrigation: 12500, other: 12500
    };
    const res = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.30,
      spendToDate: 30000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });

    expect(res.status).toBe('ready');
    expect(res.method).toBe('prior');
    expect(res.forecastFinal).toBe(80743);
    expect(res.spendToDate).toBe(30000);
    expect(res.baselineTotal).toBe(100000);
    expect(res.interval.low).toBeGreaterThanOrEqual(30000);
    expect(res.interval.high).toBeGreaterThan(res.interval.low);
  });

  test('hand-computed fixture 2: Paddy, tau=0.50, realistic baselines, spend=65,000 -> forecast=102,932 LKR', () => {
    const categoryBaselines = {
      seed: 10000, fertilizer: 30000, agrochemical: 15000, labour: 40000,
      machinery: 20000, fuel: 3000, irrigation: 1000, other: 1000
    };
    const res = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.50,
      spendToDate: 65000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });

    expect(res.status).toBe('ready');
    expect(res.forecastFinal).toBe(102932);
    expect(res.spendToDate).toBe(65000);
    expect(res.baselineTotal).toBe(120000);
    expect(res.projectedOverspendPct).toBeCloseTo(-14.2, 1);
  });

  test('hand-computed fixture 3: Paddy, tau=0.80, spend=90,000 -> forecast=110,479 LKR', () => {
    const categoryBaselines = {
      seed: 10000, fertilizer: 30000, agrochemical: 15000, labour: 40000,
      machinery: 20000, fuel: 3000, irrigation: 1000, other: 1000
    };
    const res = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.80,
      spendToDate: 90000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });

    expect(res.status).toBe('ready');
    expect(res.forecastFinal).toBe(110479);
    expect(res.spendToDate).toBe(90000);
  });

  test('minimum progress rules: returns status too_early when tau is below threshold', () => {
    const categoryBaselines = { seed: 10000, fertilizer: 20000, labour: 30000 };
    // Prior mode requires tau >= 0.30
    const earlyPrior = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.10,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });
    expect(earlyPrior.status).toBe('too_early');
    expect(earlyPrior.minTau).toBe(0.30);
    expect(earlyPrior.tau).toBe(0.1);

    // Learned mode with valid learned config requires tau >= 0.20
    const mockLearned = {
      crops: {
        Paddy: {
          n_cycles: 10,
          categories: priorsConfig.crops.Paddy.categories,
        }
      }
    };
    const earlyLearned = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.15,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'learned',
      learnedPhasingConfig: mockLearned,
      priorsConfig,
      conformalConfig,
    });
    expect(earlyLearned.status).toBe('too_early');
    expect(earlyLearned.minTau).toBe(0.20);
    expect(earlyLearned.tau).toBe(0.15);
  });

  test('boundary tau tests for sample sizes n=5 and n=300 (minimum progress gate)', () => {
    const categoryBaselines = { seed: 10000, fertilizer: 20000, labour: 30000 };
    const mockLearnedN5 = {
      crops: {
        Paddy: {
          n_cycles: 5,
          categories: priorsConfig.crops.Paddy.categories,
        }
      }
    };
    const mockLearnedN300 = {
      crops: {
        Paddy: {
          n_cycles: 300,
          categories: priorsConfig.crops.Paddy.categories,
        }
      }
    };

    // For n=5: minTau is 0.30 (derived from empirical table where tau=0.20 has S2 MAPE 16.31% > 15%)
    // At tau=0.20 -> status too_early, minTau=0.30
    const n5Below = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.20,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'learned',
      nCycles: 5,
      learnedPhasingConfig: mockLearnedN5,
      priorsConfig,
      conformalConfig,
    });
    expect(n5Below.status).toBe('too_early');
    expect(n5Below.minTau).toBe(0.30);

    // At tau=0.30 -> status ready
    const n5AtBoundary = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.30,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'learned',
      nCycles: 5,
      learnedPhasingConfig: mockLearnedN5,
      priorsConfig,
      conformalConfig,
    });
    expect(n5AtBoundary.status).toBe('ready');

    // For n=300: minTau is 0.20 (derived from empirical table where tau=0.20 has S1=13.26%, S2=13.28% <= 15%)
    // At tau=0.10 -> status too_early, minTau=0.20
    const n300Below = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.10,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'learned',
      nCycles: 300,
      learnedPhasingConfig: mockLearnedN300,
      priorsConfig,
      conformalConfig,
    });
    expect(n300Below.status).toBe('too_early');
    expect(n300Below.minTau).toBe(0.20);

    // At tau=0.20 -> status ready
    const n300AtBoundary = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.20,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'learned',
      nCycles: 300,
      learnedPhasingConfig: mockLearnedN300,
      priorsConfig,
      conformalConfig,
    });
    expect(n300AtBoundary.status).toBe('ready');

    // Prior mode keeps minTau=0.30 regardless of n
    const priorAt020 = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.20,
      spendToDate: 15000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });
    expect(priorAt020.status).toBe('too_early');
    expect(priorAt020.minTau).toBe(0.30);
  });

  test('insufficient data guards: handles zero baseline or unsupported crop', () => {
    const unsupp = computeForecastFromValues({
      crop: 'Dragonfruit',
      tau: 0.50,
      spendToDate: 10000,
      categoryBaselines: { seed: 5000 },
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });
    expect(unsupp.status).toBe('insufficient_data');
    expect(unsupp.message).toMatch(/not supported/i);

    const zeroBase = computeForecastFromValues({
      crop: 'Paddy',
      tau: 0.50,
      spendToDate: 10000,
      categoryBaselines: { seed: 0, fertilizer: 0 },
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });
    expect(zeroBase.status).toBe('insufficient_data');
    expect(zeroBase.message).toMatch(/zero or missing/i);
  });

  test('crop name aliasing: handles SO3 crop name "Chili" (alias of Green Chilli)', () => {
    const categoryBaselines = {
      seed: 5000, fertilizer: 15000, agrochemical: 10000, labour: 20000,
      machinery: 10000, fuel: 2000, irrigation: 1000, other: 1000
    };
    const res = computeForecastFromValues({
      crop: 'Chili',
      tau: 0.40,
      spendToDate: 25000,
      categoryBaselines,
      mode: 'prior',
      priorsConfig,
      conformalConfig,
    });

    expect(res.status).toBe('ready');
    expect(res.forecastFinal).toBeGreaterThan(25000);
    expect(res.baselineTotal).toBe(64000);
  });
});

describe('2. Golden Python-vs-JS Parity Cases (< 10^-6 relative error)', () => {
  // Exact outputs generated by ml/src/models/survey_prior.py and shrinkage_prior.py
  const GOLDEN_CASES = [
    {
      name: 'Case 1: Paddy tau=0.30 equal shares',
      crop: 'Paddy',
      tau: 0.30,
      spendToDate: 30000,
      categoryBaselines: {
        seed: 12500, fertilizer: 12500, agrochemical: 12500, labour: 12500,
        machinery: 12500, fuel: 12500, irrigation: 12500, other: 12500
      },
      py_expected_frac: 0.37155000000000005,
      py_final_cost_unrounded: 80742.834073476,
    },
    {
      name: 'Case 2: Paddy tau=0.50 weighted shares',
      crop: 'Paddy',
      tau: 0.50,
      spendToDate: 65000,
      categoryBaselines: {
        seed: 10000, fertilizer: 30000, agrochemical: 15000, labour: 40000,
        machinery: 20000, fuel: 3000, irrigation: 1000, other: 1000
      },
      py_expected_frac: 0.6314833333333334,
      py_final_cost_unrounded: 102932.24716760596,
    },
    {
      name: 'Case 3: Paddy tau=0.80 weighted shares',
      crop: 'Paddy',
      tau: 0.80,
      spendToDate: 90000,
      categoryBaselines: {
        seed: 10000, fertilizer: 30000, agrochemical: 15000, labour: 40000,
        machinery: 20000, fuel: 3000, irrigation: 1000, other: 1000
      },
      py_expected_frac: 0.8146374999999999,
      py_final_cost_unrounded: 110478.5872827179,
    },
    {
      name: 'Case 4: Maize tau=0.40 weighted shares',
      crop: 'Maize',
      tau: 0.40,
      spendToDate: 40000,
      categoryBaselines: {
        seed: 8000, fertilizer: 25000, agrochemical: 7000, labour: 25000,
        machinery: 12000, fuel: 2000, irrigation: 500, other: 500
      },
      py_expected_frac: 0.47807625000000004,
      py_final_cost_unrounded: 83668.66170438676,
    },
    {
      name: 'Case 5: Learned model tau=0.60',
      crop: 'Paddy',
      tau: 0.60,
      spendToDate: 65000,
      categoryBaselines: {
        seed: 10000, fertilizer: 30000, agrochemical: 15000, labour: 40000,
        machinery: 20000, fuel: 3000, irrigation: 1000, other: 1000
      },
      py_expected_frac: 0.772525,
      py_final_cost_unrounded: 84139.67185528009,
      fitted_curves: {
        seed: [0.0, 0.09090909090909091, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        fertilizer: [0.0, 0.0, 0.330909090909091, 0.330909090909091, 0.4862727272727273, 0.7112727272727273, 0.9633636363636363, 1.0, 1.0, 1.0, 1.0],
        agrochemical: [0.0, 0.00909090909090909, 0.01818181818181818, 0.02727272727272727, 0.24745454545454545, 0.5622727272727273, 0.9138181818181819, 0.9727272727272728, 0.9818181818181818, 0.990909090909091, 1.0],
        labour: [0.0, 0.15618181818181817, 0.4033636363636363, 0.4487272727272727, 0.4829090909090909, 0.624, 0.6713636363636363, 0.7018181818181819, 0.7140000000000001, 0.8708181818181818, 1.0],
        machinery: [0.0, 0.20009090909090907, 0.4248181818181818, 0.44563636363636366, 0.46854545454545454, 0.5068181818181818, 0.5400909090909091, 0.5585454545454546, 0.5668181818181819, 0.8390909090909091, 1.0],
        fuel: [0.0, 0.20918181818181816, 0.44299999999999995, 0.47290909090909095, 0.5049090909090909, 0.5522727272727272, 0.5946363636363636, 0.6221818181818182, 0.6395454545454546, 0.83, 1.0],
        irrigation: [0.0, 0.00909090909090909, 0.01818181818181818, 0.24036363636363636, 0.4, 0.5, 0.6, 0.9112727272727272, 0.9818181818181818, 0.990909090909091, 1.0],
        other: [0.0, 0.00909090909090909, 0.01818181818181818, 0.02727272727272727, 0.03636363636363636, 0.045454545454545456, 0.05454545454545454, 0.06363636363636363, 0.07272727272727272, 0.5495454545454546, 1.0],
      }
    },
  ];

  for (const gc of GOLDEN_CASES) {
    test(`parity: ${gc.name} relative error < 10^-6`, () => {
      const totBase = Object.values(gc.categoryBaselines).reduce((a, b) => a + b, 0);
      const shares = {};
      for (const [cat, b] of Object.entries(gc.categoryBaselines)) {
        shares[cat] = b / totBase;
      }

      let curves = {};
      if (gc.fitted_curves) {
        curves = gc.fitted_curves;
      } else {
        const cropPriors = priorsConfig.crops[gc.crop].categories;
        for (const cat of Object.keys(gc.categoryBaselines)) {
          curves[cat] = cropPriors[cat].p50;
        }
      }

      const jsFrac = computeExpectedFraction(gc.tau, shares, curves);
      const fracRelErr = Math.abs(jsFrac - gc.py_expected_frac) / gc.py_expected_frac;
      expect(fracRelErr).toBeLessThan(1e-6);

      const jsPointForecast = gc.spendToDate / jsFrac;
      const forecastRelErr = Math.abs(jsPointForecast - gc.py_final_cost_unrounded) / gc.py_final_cost_unrounded;
      expect(forecastRelErr).toBeLessThan(1e-6);
    });
  }
});

describe('3. API Endpoint Integration: GET /api/cycles/:id/forecast', () => {
  let userA, tokenA, farmerA, cycleA;
  let userB, tokenB, farmerB;

  beforeEach(async () => {
    // Farmer A
    userA = await User.create({
      name: 'Farmer Alpha',
      email: `alpha_${Date.now()}_${Math.random()}@aswanna.lk`,
      passwordHash: await User.hashPassword('Password123'),
      role: 'farmer',
    });
    tokenA = jwt.sign({ sub: userA._id.toString(), role: userA.role }, ENV.JWT_SECRET);
    farmerA = await FarmerProfile.create({
      userId: userA._id,
      nic: `1985${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: '0711111111',
    });

    // Farmer B
    userB = await User.create({
      name: 'Farmer Beta',
      email: `beta_${Date.now()}_${Math.random()}@aswanna.lk`,
      passwordHash: await User.hashPassword('Password123'),
      role: 'farmer',
    });
    tokenB = jwt.sign({ sub: userB._id.toString(), role: userB.role }, ENV.JWT_SECRET);
    farmerB = await FarmerProfile.create({
      userId: userB._id,
      nic: `1986${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: '0722222222',
    });

    // Cycle A: 100 days long, started 50 days ago (tau = 0.50)
    const now = Date.now();
    cycleA = await Cycle.create({
      farmerId: farmerA._id,
      crop: 'Paddy',
      season: 'Maha',
      district: 'Ampara',
      startDate: new Date(now - 50 * 86400000),
      endDate: new Date(now + 50 * 86400000),
      status: 'active',
      baselineStatus: 'ready',
    });

    // Baselines for Cycle A
    const categories = ['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other'];
    for (const cat of categories) {
      await Baseline.create({
        cycleId: cycleA._id,
        category: cat,
        expected: 20000,
        low: 18000,
        high: 23000,
        totalPredictedCost: 160000,
      });
    }

    let act = await ActivityCode.findOne();
    if (!act) {
      act = await ActivityCode.create({ code: 'LAND_PREP', name: 'Land Preparation', stage: 'land_preparation', categoryTag: 'seed' });
    }

    // Expense for Cycle A
    await Expense.create({
      cycleId: cycleA._id,
      activityCode: act._id,
      dayStatus: 'worked',
      entryDate: new Date(now - 40 * 86400000),
      inputs: [{ categoryTag: 'seed', cost: 15000 }],
      subtotals: { inputs: 15000 },
    });
  });

  afterEach(() => {
    delete process.env.FORECAST_MODE;
  });

  test('mode off returns HTTP 404 NOT_FOUND', async () => {
    process.env.FORECAST_MODE = 'off';

    const res = await request(app)
      .get(`/api/cycles/${cycleA._id}/forecast`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toMatch(/disabled/i);
  });

  test('default mode (unset FORECAST_MODE) returns HTTP 404 disabled response', async () => {
    delete process.env.FORECAST_MODE;

    const res = await request(app)
      .get(`/api/cycles/${cycleA._id}/forecast`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toMatch(/disabled/i);
  });

  test('owner isolation: unauthorized farmer B receives HTTP 403 FORBIDDEN', async () => {
    process.env.FORECAST_MODE = 'prior';

    const res = await request(app)
      .get(`/api/cycles/${cycleA._id}/forecast`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('mode prior: owner farmer A receives 200 OK with survey prior projection and advisory note', async () => {
    process.env.FORECAST_MODE = 'prior';

    const alertsBefore = await Alert.countDocuments({ cycleId: cycleA._id });

    const res = await request(app)
      .get(`/api/cycles/${cycleA._id}/forecast`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.status).toBe('ready');
    expect(res.body.method).toBe('prior');
    expect(res.body.tau).toBeCloseTo(0.50, 1);
    expect(res.body.spendToDate).toBe(15000);
    expect(res.body.baselineTotal).toBe(160000);
    expect(res.body.forecastFinal).toBeGreaterThanOrEqual(15000);
    expect(res.body.interval.level).toBe(0.8);
    expect(res.body.interval.low).toBeGreaterThanOrEqual(15000);
    expect(res.body.interval.high).toBeGreaterThan(res.body.interval.low);
    expect(res.body.notes).toEqual(expect.arrayContaining([expect.stringMatching(/advisory projection/i)]));

    // ADVISORY ONLY INVARIANT: asserts 0 Alert documents were created by forecasting
    const alertsAfter = await Alert.countDocuments({ cycleId: cycleA._id });
    expect(alertsAfter).toBe(alertsBefore);
  });

  test('learned mode switch: n < 5 falls back to prior; n >= 5 uses learned model', async () => {
    process.env.FORECAST_MODE = 'learned';

    // 1. Without learnedPhasing.json (or n < 5), falls back to prior
    const resFallback = await request(app)
      .get(`/api/cycles/${cycleA._id}/forecast`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resFallback.body.status).toBe('ready');
    expect(resFallback.body.method).toBe('prior');
    expect(resFallback.body.notes).toEqual(expect.arrayContaining([expect.stringMatching(/insufficient.*fell back to survey prior/i)]));

    // 2. Mock learnedPhasing.json with n=5 cycles
    const learnedPath = path.join(sharedConfigDir, 'learnedPhasing.json');
    const mockLearned = {
      metadata: { version: '1.0.0', source: 'test' },
      crops: {
        Paddy: {
          n_cycles: 5,
          k_shrinkage: 50.0,
          categories: {
            seed: [0, 0.1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            fertilizer: [0, 0, 0.3, 0.3, 0.5, 0.7, 0.9, 1, 1, 1, 1],
            agrochemical: [0, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1, 1, 1, 1],
            labour: [0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],
            machinery: [0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1, 1],
            fuel: [0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1, 1],
            irrigation: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
            other: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
          }
        }
      }
    };
    fs.writeFileSync(learnedPath, JSON.stringify(mockLearned, null, 2), 'utf8');

    try {
      const resLearned = await request(app)
        .get(`/api/cycles/${cycleA._id}/forecast`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(resLearned.body.status).toBe('ready');
      expect(resLearned.body.method).toBe('learned');
    } finally {
      if (fs.existsSync(learnedPath)) {
        fs.unlinkSync(learnedPath);
      }
    }
  });
});
