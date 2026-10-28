/**
 * phase3.test.js – Comprehensive Phase 3 Test Suite.
 *
 * Covers:
 *   1. Hand-computed fixtures & arithmetic (including fertilizer day 30 of 90 fixture)
 *   2. Exact boundaries at 7%, 10%, 12%, 15% (both sides and exact)
 *   3. Single vs Tiered threshold mode
 *   4. Zero baseline flagged state (no_baseline reason)
 *   5. Same-request alert in create response (both HTTP and service level)
 *   6. Resolve endpoint & severity/resolved filters on GET /api/alerts
 *   7. Divide-by-zero & Day 0 guards
 *   8. Closed cycle & ownership enforcement
 */

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { ENV } from '../src/config/env.js';
import { phasingFor } from '../../shared/phasing.js';
import { computeVariance, computeTier, categoryVolatility, DEFAULT_THRESHOLDS } from '../../shared/variance.js';
import { Baseline } from '../src/models/Baseline.js';
import { ThresholdConfig } from '../src/models/ThresholdConfig.js';
import { Alert } from '../src/models/Alert.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { ActivityCode } from '../src/models/ActivityCode.js';
import { recomputeAlerts } from '../src/services/alertService.js';
import { createExpense, updateExpense, deleteExpense } from '../src/services/expenseService.js';
import { setSo1Fetcher, resetSo1Fetcher } from '../src/services/baselineService.js';
import { transitionCycle } from '../src/services/cycleService.js';

// ── 1. Hand-Computed Fixtures & Arithmetic ────────────────────────────────────

describe('Hand-Computed Fixtures & Arithmetic', () => {
  test('phasingFor exact values for labour and seed', () => {
    expect(phasingFor('labour', 0, 120)).toBe(0);
    expect(phasingFor('labour', 60, 120)).toBeCloseTo(0.5, 4);
    expect(phasingFor('labour', 120, 120)).toBe(1);
    expect(phasingFor('seed', 18, 120)).toBeCloseTo(0.70, 2);
  });

  test('hand fixture: fertilizer expected 45000, day 30 of 90, phase 0.5, actual 25200 -> expectedToDate 22500, variancePct +12.0%, tier attention', () => {
    const baselines = {
      fertilizer: { expected: 45000, low: 40500, high: 51750, phase: 0.5 },
    };

    // Day 30 of 90 with phase forced/calculated at 0.5: expectedToDate = 22500.
    // Actual = 25200. variancePct = (25200 - 22500) / 22500 = +0.120 (+12.0%).
    // Volatile category fertilizer: <= 0.12 is attention (<= 12%), > 0.12 is significant.
    const result = computeVariance({
      baselines,
      actuals: { fertilizer: 25200 },
      dayOfCycle: 30,
      cycleLength: 90,
    });

    const fert = result.categories.fertilizer;
    expect(fert.expectedToDate).toBe(22500);
    expect(fert.variancePct).toBeCloseTo(0.12, 4);
    expect(fert.tier).toBe('attention');

    // Test just above boundary (25201) -> significant
    const resultAbove = computeVariance({
      baselines,
      actuals: { fertilizer: 25201 },
      dayOfCycle: 30,
      cycleLength: 90,
    });
    expect(resultAbove.categories.fertilizer.tier).toBe('significant');
  });

  test('computeVariance returns separate expectedToDate, variancePct, budgetUsedPct fields', () => {
    const baselines = {
      seed: { expected: 25000, low: 22500, high: 28750 },
      labour: { expected: 60000, low: 54000, high: 69000 },
    };

    const result = computeVariance({
      baselines,
      actuals: { seed: 0, labour: 33000 },
      dayOfCycle: 60,
      cycleLength: 120,
    });

    const labour = result.categories.labour;
    expect(labour.expectedToDate).toBe(30000);
    expect(labour.variancePct).toBeCloseTo(0.10, 4);
    expect(labour.budgetUsedPct).toBeCloseTo(0.55, 4);
    expect(labour.tier).toBe('normal');
  });
});

// ── 2. Exact Threshold Boundaries (Table 3) ───────────────────────────────────

describe('Exact Threshold Boundaries (Table 3)', () => {
  test('exact boundary 7% volatile: below 0.0699 is normal', () => {
    expect(computeTier(0.0699, 'seed')).toBe('normal');
  });

  test('exact boundary 7% volatile: exact 0.07 is normal', () => {
    expect(computeTier(0.07, 'seed')).toBe('normal');
  });

  test('exact boundary 7% volatile: above 0.07001 is attention', () => {
    expect(computeTier(0.07001, 'seed')).toBe('attention');
  });

  test('exact boundary 10% stable: below 0.0999 is normal', () => {
    expect(computeTier(0.0999, 'labour')).toBe('normal');
  });

  test('exact boundary 10% stable: exact 0.10 is normal', () => {
    expect(computeTier(0.10, 'labour')).toBe('normal');
  });

  test('exact boundary 10% stable: above 0.10001 is attention', () => {
    expect(computeTier(0.10001, 'labour')).toBe('attention');
  });

  test('exact boundary 12% volatile: below 0.1199 is attention', () => {
    expect(computeTier(0.1199, 'seed')).toBe('attention');
  });

  test('exact boundary 12% volatile: exact 0.12 is attention', () => {
    expect(computeTier(0.12, 'seed')).toBe('attention');
  });

  test('exact boundary 12% volatile: above 0.12001 is significant', () => {
    expect(computeTier(0.12001, 'seed')).toBe('significant');
  });

  test('exact boundary 15% stable: below 0.1499 is attention', () => {
    expect(computeTier(0.1499, 'labour')).toBe('attention');
  });

  test('exact boundary 15% stable: exact 0.15 is attention', () => {
    expect(computeTier(0.15, 'labour')).toBe('attention');
  });

  test('exact boundary 15% stable: above 0.15001 is significant', () => {
    expect(computeTier(0.15001, 'labour')).toBe('significant');
  });
});

// ── 3. Single vs Tiered Mode ──────────────────────────────────────────────────

describe('ThresholdConfig Single vs Tiered Mode', () => {
  test('single mode produces binary alert at single threshold (0.10)', () => {
    const singleCfg = { mode: 'single', single: 0.10 };
    expect(computeTier(0.09, 'seed', singleCfg)).toBe('normal');
    expect(computeTier(0.10, 'seed', singleCfg)).toBe('normal');
    expect(computeTier(0.1001, 'seed', singleCfg)).toBe('significant');
  });

  test('tiered mode respects category volatility', () => {
    const tieredCfg = { mode: 'tiered', volatile: { attention: 0.07, significant: 0.12 }, stable: { attention: 0.10, significant: 0.15 } };
    expect(computeTier(0.08, 'seed', tieredCfg)).toBe('attention');
    expect(computeTier(0.08, 'labour', tieredCfg)).toBe('normal');
  });
});

// ── 4. Zero Baseline Flagged State ─────────────────────────────────────────────

describe('Zero Baseline Flagged State', () => {
  test('zero baseline: spend above zero expectedToDate returns attention tier and no_baseline reason', () => {
    const result = computeVariance({
      baselines: { agrochemical: { expected: 0 } },
      actuals: { agrochemical: 500 },
      dayOfCycle: 10,
      cycleLength: 120,
    });

    const agro = result.categories.agrochemical;
    expect(agro.expectedToDate).toBe(0);
    expect(agro.tier).toBe('attention');
    expect(agro.reason).toBe('no_baseline');
  });

  test('zero baseline: zero spend on zero expectedToDate returns normal tier', () => {
    const result = computeVariance({
      baselines: { agrochemical: { expected: 0 } },
      actuals: { agrochemical: 0 },
      dayOfCycle: 10,
      cycleLength: 120,
    });

    const agro = result.categories.agrochemical;
    expect(agro.tier).toBe('normal');
    expect(agro.reason).toBeNull();
  });
});

// ── 5. Divide-by-Zero and Day 0 Guards ────────────────────────────────────────

describe('Divide-by-Zero and Day 0 Guards', () => {
  test('divide-by-zero and day 0: Day 0 produces 0 expectedToDate, 0 variancePct, no crash', () => {
    const result = computeVariance({
      baselines: { seed: { expected: 25000 } },
      actuals: { seed: 5000 },
      dayOfCycle: 0,
      cycleLength: 120,
    });

    expect(result.categories.seed.expectedToDate).toBe(0);
    expect(result.categories.seed.variancePct).toBe(0);
    expect(result.categories.seed.tier).toBe('normal');
  });
});

// ── 6. Integration: Same-Request Alerts, Resolve & Filters ─────────────────────

describe('Integration: Same-Request Alerts & Resolve Endpoint', () => {
  let user, token, farmerProfile, cycle, activityCode;

  beforeEach(async () => {
    user = await User.create({
      name: 'Farmer Test',
      email: `testfarmer_${Date.now()}_${Math.random()}@aswanna.lk`,
      passwordHash: await User.hashPassword('Password123'),
      role: 'farmer',
    });
    token = jwt.sign({ sub: user._id.toString(), role: user.role }, ENV.JWT_SECRET);

    farmerProfile = await FarmerProfile.create({
      userId: user._id,
      nic: `1990${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: '0771234567',
    });

    cycle = await Cycle.create({
      farmerId: farmerProfile._id,
      crop: 'Paddy',
      season: 'Yala',
      startDate: new Date(),
      endDate: new Date(Date.now() + 120 * 86400000),
      status: 'active',
    });

    activityCode = await ActivityCode.create({
      code: `AC_${Date.now()}_${Math.random()}`,
      nameEn: 'Field Prep',
    });

    await Baseline.create({ cycleId: cycle._id, category: 'seed', expected: 25000, low: 22500, high: 28750 });
    await Baseline.create({ cycleId: cycle._id, category: 'labour', expected: 60000, low: 54000, high: 69000 });
  });

  test('same-request alert in the create response: POST /api/expenses returns recomputed alerts array', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id.toString(),
        activityCode: activityCode._id.toString(),
        entryDate: new Date().toISOString().slice(0, 10),
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'seed', cost: 25000 }],
      })
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.alerts).toBeDefined();
    expect(Array.isArray(res.body.alerts)).toBe(true);
    const seedAlert = res.body.alerts.find(a => a.category === 'seed');
    expect(seedAlert).toBeDefined();
    expect(seedAlert.tier).toBe('significant');
  });

  test('same-request alert: createExpense service returns alerts and recomputes synchronously', async () => {
    const res = await createExpense(
      cycle._id,
      {
        entryDate: new Date().toISOString().slice(0, 10),
        dayStatus: 'no_work',
        inputs: [{ categoryTag: 'seed', cost: 25000 }],
      },
      user._id
    );

    expect(res.created).toBe(true);
    expect(res.alerts).toBeDefined();

    const alert = await Alert.findOne({ cycleId: cycle._id, category: 'seed' });
    expect(alert).not.toBeNull();
    expect(alert.tier).toBe('significant');
    expect(alert.resolvedAt).toBeNull();
  });

  test('resolve: POST /api/alerts/:id/resolve sets resolvedAt timestamp and returns updated alert', async () => {
    const alert = await Alert.create({
      cycleId: cycle._id,
      category: 'seed',
      tier: 'significant',
      variancePct: 0.25,
      expectedToDate: 17500,
      actualToDate: 21875,
      dayOfCycle: 20,
      resolvedAt: null,
    });

    const res = await request(app)
      .post(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.resolvedAt).not.toBeNull();
    const updated = await Alert.findById(alert._id);
    expect(updated.resolvedAt).not.toBeNull();
  });

  test('alerts filters: GET /api/alerts filters by severity and resolved status', async () => {
    const alert1 = await Alert.create({
      cycleId: cycle._id,
      category: 'seed',
      tier: 'significant',
      variancePct: 0.25,
      expectedToDate: 17500,
      actualToDate: 21875,
      dayOfCycle: 20,
      resolvedAt: new Date(),
    });

    const alert2 = await Alert.create({
      cycleId: cycle._id,
      category: 'labour',
      tier: 'attention',
      variancePct: 0.12,
      expectedToDate: 30000,
      actualToDate: 33600,
      dayOfCycle: 20,
      resolvedAt: null,
    });

    // Filter severity = attention
    const sevRes = await request(app)
      .get(`/api/alerts?cycleId=${cycle._id}&severity=attention`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(sevRes.body.length).toBe(1);
    expect(sevRes.body[0].category).toBe('labour');

    // Filter resolved = false
    const unresRes = await request(app)
      .get(`/api/alerts?cycleId=${cycle._id}&resolved=false`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(unresRes.body.length).toBe(1);
    expect(unresRes.body[0]._id).toBe(alert2._id.toString());
  });

  test('closed cycle: writing expense to a closed cycle returns 409 CYCLE_CLOSED', async () => {
    await Cycle.findByIdAndUpdate(cycle._id, { status: 'closed' });

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id.toString(),
        activityCode: activityCode._id.toString(),
        entryDate: new Date().toISOString().slice(0, 10),
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'seed', cost: 1000 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CYCLE_CLOSED');
  });

  test('ownership: GET /api/cycles/:id/variance returns 403 for unauthorized farmer', async () => {
    const otherUser = await User.create({
      name: 'Other Farmer',
      email: `other_${Date.now()}_${Math.random()}@aswanna.lk`,
      passwordHash: await User.hashPassword('Password123'),
      role: 'farmer',
    });
    const otherToken = jwt.sign({ sub: otherUser._id.toString(), role: otherUser.role }, ENV.JWT_SECRET);

    await request(app)
      .get(`/api/cycles/${cycle._id}/variance`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });
});

// ── 9. Baseline Lifecycle, Activation & Failure Recovery ──────────────────────

describe('Baseline Lifecycle, Activation & Failure Recovery', () => {
  let user, farmerProfile, token;

  beforeEach(async () => {
    resetSo1Fetcher();
    user = await User.create({
      name: 'Baseline Test Farmer',
      email: `baseline_farmer_${Date.now()}_${Math.random()}@aswanna.lk`,
      passwordHash: await User.hashPassword('Password123'),
      role: 'farmer',
    });
    farmerProfile = await FarmerProfile.create({
      userId: user._id,
      name: 'Baseline Test Farmer',
      district: 'Kurunegala',
    });
    token = jwt.sign({ sub: user._id.toString(), role: user.role }, ENV.JWT_SECRET);
  });

  afterEach(() => {
    resetSo1Fetcher();
  });

  test('activating a cycle stores a baseline (assert rows exist and baselineStatus is ready)', async () => {
    const draftCycle = await Cycle.create({
      farmerId: farmerProfile._id,
      crop: 'Tomato',
      season: 'Yala',
      district: 'Kurunegala',
      status: 'draft',
      startDate: new Date(),
    });

    // Before activation: no baseline rows exist for this cycle
    const initialRows = await Baseline.find({ cycleId: draftCycle._id });
    expect(initialRows.length).toBe(0);

    // Transition draft cycle to active
    const res = await request(app)
      .post(`/api/cycles/${draftCycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'active' })
      .expect(200);

    // Assert cycle response indicates active status and ready baseline
    expect(res.body.status).toBe('active');
    expect(res.body.baselineStatus).toBe('ready');
    expect(res.body.baselineSource).toBe('SO1');

    // Assert baseline rows were persisted in database
    const storedRows = await Baseline.find({ cycleId: draftCycle._id });
    expect(storedRows.length).toBe(8);
    const seedRow = storedRows.find(r => r.category === 'seed');
    expect(seedRow).toBeDefined();
    expect(seedRow.expected).toBe(25000);

    // Assert GET /api/cycles/:id exposes baselineStatus = 'ready'
    const getRes = await request(app)
      .get(`/api/cycles/${draftCycle._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.baselineStatus).toBe('ready');
    expect(getRes.body.baselineSource).toBe('SO1');
  });

  test('a simulated SO1 failure sets baselineStatus missing', async () => {
    const draftCycle = await Cycle.create({
      farmerId: farmerProfile._id,
      crop: 'Paddy',
      season: 'Maha',
      district: 'Kurunegala',
      status: 'draft',
      startDate: new Date(),
    });

    // Simulate an SO1 downstream failure
    setSo1Fetcher(async () => {
      throw new Error('Simulated SO1 connection failure');
    });

    // Transition cycle to active with simulated failure
    const res = await request(app)
      .post(`/api/cycles/${draftCycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'active' })
      .expect(200);

    expect(res.body.status).toBe('active');
    expect(res.body.baselineStatus).toBe('missing');

    // Assert DB record has baselineStatus = 'missing'
    const updatedCycle = await Cycle.findById(draftCycle._id);
    expect(updatedCycle.baselineStatus).toBe('missing');

    // Assert 0 baseline rows exist
    const rows = await Baseline.find({ cycleId: draftCycle._id });
    expect(rows.length).toBe(0);

    // Assert GET /api/cycles/:id exposes baselineStatus = 'missing'
    const getRes = await request(app)
      .get(`/api/cycles/${draftCycle._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.baselineStatus).toBe('missing');
  });

  test('variance endpoint on a missing baseline returns a clear state, not zeros', async () => {
    const cycle = await Cycle.create({
      farmerId: farmerProfile._id,
      crop: 'Maize',
      season: 'Yala',
      district: 'Kurunegala',
      status: 'active',
      baselineStatus: 'missing',
      startDate: new Date(),
    });

    const res = await request(app)
      .get(`/api/cycles/${cycle._id}/variance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Assert clear state: status indicates missing baseline, metrics are null, not silent zeros
    expect(res.body.status).toBe('missing_baseline');
    expect(res.body.baselineStatus).toBe('missing');
    expect(res.body.baselines).toBeNull();
    expect(res.body.total).toBeNull();
    expect(res.body.categories).toBeNull();
    expect(res.body.message).toMatch(/no baseline/i);

    // Retry baseline recovery via retry endpoint
    resetSo1Fetcher(); // restore normal in-process stub
    const retryRes = await request(app)
      .post(`/api/cycles/${cycle._id}/retry-baseline`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(retryRes.body.success).toBe(true);
    expect(retryRes.body.baselineStatus).toBe('ready');
    expect(retryRes.body.rows).toBe(8);

    // After retry, variance endpoint returns populated variance data
    const secondVarRes = await request(app)
      .get(`/api/cycles/${cycle._id}/variance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(secondVarRes.body.status).toBeUndefined();
    expect(secondVarRes.body.total).toBeDefined();
    expect(secondVarRes.body.total.expected).toBeGreaterThan(0);
  });
});
