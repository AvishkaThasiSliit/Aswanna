/**
 * api.test.js – Supertest integration tests for all Phase 1A requirements.
 *
 * Covers:
 *  1. Auth flow (register, login, me)
 *  2. Ownership: farmerA cannot read farmerB's expenses (403/404)
 *  3. Idempotent POST: double-submit returns one record
 *  4. Server corrects wrong clientTotalAmount
 *  5. Worked day with all-zero costs rejected (422)
 *  6. Closed cycle returns 409
 *  7. Soft-delete hides record; restore within 10s works; after 10s fails
 *  8. Filters and pagination
 *  9. CSV export
 * 10. Forward-only cycle transitions
 * 11. Audit log written on create/update/delete
 */

import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ActivityCode } from '../src/models/ActivityCode.js';

// ─── Shared ActivityCode ───────────────────────────────────────────────────────
// The Expense model requires activityCode for worked-day expenses.
// We create one here and re-create it before each test suite's beforeAll
// because afterEach drops all collections.

let sharedActivityCodeId = null;

async function ensureActivityCode() {
  if (!sharedActivityCodeId) {
    const ac = await ActivityCode.create({ code: 'TEST-01', nameEn: 'Test Activity' });
    sharedActivityCodeId = ac._id.toString();
  }
  return sharedActivityCodeId;
}

// Reset the cached id after each afterEach wipes collections
afterEach(() => { sharedActivityCodeId = null; });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Test Farmer',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    role: 'farmer',
  };
  const body = { ...defaults, ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  return res.body; // { token, user }
}

async function registerAndLogin(overrides = {}) {
  const { user, token } = await registerUser(overrides);
  return { token, user };
}

async function createFarmerProfile(token, extraFields = {}) {
  const res = await request(app)
    .post('/api/farmer-profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Farmer Profile', ...extraFields });
  return res.body;
}

async function createCycle(token, farmerId, extraFields = {}) {
  const res = await request(app)
    .post('/api/cycles')
    .set('Authorization', `Bearer ${token}`)
    .send({ farmerId, status: 'active', ...extraFields });
  return res.body;
}

// Standard expense payload – always includes a valid activityCode
async function makeExpensePayload(cycleId, overrides = {}) {
  const activityCode = await ensureActivityCode();
  return {
    cycleId,
    activityCode,
    dayStatus: 'worked',
    entryDate: new Date().toISOString(),
    inputs: [{ categoryTag: 'fertilizer', cost: 1000 }],
    machinery: {},
    labour: {},
    other: {},
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Auth Flow', () => {
  test('POST /api/auth/register creates user and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  test('POST /api/auth/register with duplicate email returns 409', async () => {
    await request(app).post('/api/auth/register').send({ name: 'A', email: 'dup@x.com', password: 'pass123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'B', email: 'dup@x.com', password: 'pass123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test('POST /api/auth/login with valid credentials returns token', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@example.com', password: 'secret123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login with wrong password returns 401', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Charlie', email: 'charlie@example.com', password: 'right' });
    const res = await request(app).post('/api/auth/login').send({ email: 'charlie@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('GET /api/auth/me returns current user', async () => {
    const { token } = await registerAndLogin({ email: 'me@example.com' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });

  test('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Ownership: farmer A cannot read farmer B data', () => {
  test('farmerA gets 403/404 when accessing farmerB expenses', async () => {
    // Create farmerA
    const { token: tokenA, user: userA } = await registerAndLogin({ email: 'farmerA@example.com' });
    const profileA = await createFarmerProfile(tokenA);
    const cycleA = await createCycle(tokenA, profileA._id);

    // Create farmerB
    const { token: tokenB, user: userB } = await registerAndLogin({ email: 'farmerB@example.com' });
    const profileB = await createFarmerProfile(tokenB);
    const cycleB = await createCycle(tokenB, profileB._id);

    // FarmerB creates an expense in cycleB
    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send(await makeExpensePayload(cycleB._id));
    expect(expRes.status).toBeLessThan(300);
    const expId = expRes.body._id;

    // FarmerA tries to read it
    const readRes = await request(app)
      .get(`/api/expenses/${expId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(readRes.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Idempotent POST /api/expenses', () => {
  test('double-submit with same clientRequestId returns same record (200 on retry)', async () => {
    const { token } = await registerAndLogin({ email: 'idem@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const payload = await makeExpensePayload(cycle._id, { clientRequestId: 'unique-req-id-1' });

    const res1 = await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body._id).toBe(res1.body._id);

    const count = await Expense.countDocuments({ clientRequestId: 'unique-req-id-1' });
    expect(count).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Server corrects wrong client totalAmount', () => {
  test('totalAmount in response is server-computed, not client-supplied', async () => {
    const { token } = await registerAndLogin({ email: 'total@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const payload = await makeExpensePayload(cycle._id, {
      inputs: [{ categoryTag: 'fertilizer', cost: 5000 }],
      totalAmount: 999999, // client lies
    });

    const res = await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(5000); // server overrides
    expect(res.body.totalAmount).not.toBe(999999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Worked day with all-zero costs rejected', () => {
  test('POST with dayStatus=worked and no costs returns 422', async () => {
    const { token } = await registerAndLogin({ email: 'zero@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    // Include activityCode so the model's activityCode-required validation passes
    // and the ZERO_COST_WORKED_DAY guard is reached
    const actCode = await ensureActivityCode();
    const payload = {
      cycleId: cycle._id,
      activityCode: actCode,
      dayStatus: 'worked',
      entryDate: new Date().toISOString(),
      inputs: [],
      machinery: {},
      labour: {},
      other: {},
    };

    const res = await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ZERO_COST_WORKED_DAY');
  });

  test('POST with dayStatus=no_work and zero costs is accepted', async () => {
    const { token } = await registerAndLogin({ email: 'nowork@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const payload = {
      cycleId: cycle._id,
      dayStatus: 'no_work',
      entryDate: new Date().toISOString(),
      inputs: [],
      machinery: {},
      labour: {},
      other: {},
    };

    const res = await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Closed cycle returns 409', () => {
  test('POST expense to closed cycle returns 409 CYCLE_CLOSED', async () => {
    const { token } = await registerAndLogin({ email: 'closed@example.com' });
    const profile = await createFarmerProfile(token);

    // Create closed cycle directly in DB
    const cycle = await Cycle.create({
      farmerId: profile._id,
      status: 'closed',
    });

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id.toString()));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CYCLE_CLOSED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Soft delete, restore within 10s, restore after 10s fails', () => {
  test('DELETE hides record; GET returns 404; restore within 10s works', async () => {
    const { token } = await registerAndLogin({ email: 'softdel@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));
    expect(expRes.status).toBe(201);
    const expId = expRes.body._id;

    // Delete
    const delRes = await request(app)
      .delete(`/api/expenses/${expId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // GET should now return 404
    const getRes = await request(app).get(`/api/expenses/${expId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);

    // Restore within 10s
    const restoreRes = await request(app)
      .post(`/api/expenses/${expId}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.deletedAt).toBeNull();

    // Verify accessible again
    const getResAfter = await request(app).get(`/api/expenses/${expId}`).set('Authorization', `Bearer ${token}`);
    expect(getResAfter.status).toBe(200);
  });

  test('Restore after 10s fails with 409 RESTORE_WINDOW_EXPIRED', async () => {
    const { token } = await registerAndLogin({ email: 'restoreexp@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));
    const expId = expRes.body._id;

    // Manually set deletedAt to 15 seconds ago
    const longAgo = new Date(Date.now() - 15000);
    await Expense.findByIdAndUpdate(expId, { deletedAt: longAgo });

    const restoreRes = await request(app)
      .post(`/api/expenses/${expId}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.status).toBe(409);
    expect(restoreRes.body.error.code).toBe('RESTORE_WINDOW_EXPIRED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Filters and pagination', () => {
  test('GET /api/expenses with cycleId filter returns only that cycle expenses', async () => {
    const { token } = await registerAndLogin({ email: 'filter@example.com' });
    const profile = await createFarmerProfile(token);
    const cycleA = await createCycle(token, profile._id);
    const cycleB = await createCycle(token, profile._id);

    // Create expenses in both cycles
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycleA._id));
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycleB._id));

    const res = await request(app)
      .get(`/api/expenses?cycleId=${cycleA._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    // cycleId is serialised as a string in JSON; compare both sides as strings
    expect(String(res.body.items[0].cycleId)).toBe(String(cycleA._id));
  });

  test('Pagination: page and pageSize work correctly', async () => {
    const { token } = await registerAndLogin({ email: 'paginate@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    // Create 5 expenses
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
        .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'fertilizer', cost: 1000 + i }] }));
    }

    const res = await request(app)
      .get('/api/expenses?page=1&pageSize=3')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(3);
  });

  test('Totals are computed server-side in list response', async () => {
    const { token } = await registerAndLogin({ email: 'totals@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'fertilizer', cost: 2000 }] }));

    const res = await request(app).get('/api/expenses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totals).toBeDefined();
    expect(res.body.totals.totalSpending).toBeGreaterThanOrEqual(2000);
    expect(typeof res.body.totals.count).toBe('number');
    expect(typeof res.body.totals.todayExpense).toBe('number');
  });

  test('Category filter: machinery group returns correct records', async () => {
    const { token } = await registerAndLogin({ email: 'catfilter@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    // One with machinery cost, one with only input cost
    const acId = await ensureActivityCode();
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, activityCode: acId, dayStatus: 'worked', inputs: [], machinery: { cost: 3000 }, labour: {}, other: {} });
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));

    const res = await request(app).get('/api/expenses?category=machinery').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every(e => (e.subtotals?.machinery || 0) > 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('CSV Export', () => {
  test('GET /api/expenses/export.csv returns CSV content', async () => {
    const { token } = await registerAndLogin({ email: 'csv@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));

    const res = await request(app)
      .get('/api/expenses/export.csv')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.split('\n');
    expect(lines[0]).toContain('_id');
    expect(lines.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Forward-only cycle transitions', () => {
  test('draft -> active is allowed', async () => {
    const { token } = await registerAndLogin({ email: 'trans1@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'draft' });

    const res = await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  test('active -> closed (skipping harvesting) is rejected', async () => {
    const { token } = await registerAndLogin({ email: 'trans2@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active' });

    const res = await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'closed' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  test('closed -> active (going backward) is rejected', async () => {
    const { token } = await registerAndLogin({ email: 'trans3@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await Cycle.create({ farmerId: profile._id, status: 'closed' });

    const res = await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'active' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  test('full happy path: draft->active->harvesting->closed', async () => {
    const { token } = await registerAndLogin({ email: 'trans4@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'draft' });
    const id = cycle._id;

    for (const [from, to] of [['draft', 'active'], ['active', 'harvesting'], ['harvesting', 'closed']]) {
      const r = await request(app)
        .post(`/api/cycles/${id}/transition`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: to });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe(to);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Audit log written on create/update/delete', () => {
  test('Creating an expense writes a create audit log', async () => {
    const { token } = await registerAndLogin({ email: 'audit1@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));
    expect(expRes.status).toBe(201);

    const logs = await AuditLog.find({ entityId: expRes.body._id, action: 'create' });
    expect(logs.length).toBe(1);
    expect(logs[0].entity).toBe('Expense');
  });

  test('Updating an expense writes an update audit log', async () => {
    const { token } = await registerAndLogin({ email: 'audit2@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));
    const expId = expRes.body._id;

    await request(app)
      .put(`/api/expenses/${expId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ inputs: [{ categoryTag: 'seed', cost: 2000 }] });

    const logs = await AuditLog.find({ entityId: expId, action: 'update' });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  test('Deleting an expense writes a delete audit log', async () => {
    const { token } = await registerAndLogin({ email: 'audit3@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id));
    const expId = expRes.body._id;

    await request(app).delete(`/api/expenses/${expId}`).set('Authorization', `Bearer ${token}`);

    const logs = await AuditLog.find({ entityId: expId, action: 'delete' });
    expect(logs.length).toBe(1);
    expect(logs[0].before).toBeDefined();
    expect(logs[0].after.deletedAt).not.toBeNull();
  });

  test('Creating a farmer profile writes a create audit log', async () => {
    const { token } = await registerAndLogin({ email: 'audit4@example.com' });
    const profileRes = await createFarmerProfile(token);

    const logs = await AuditLog.find({ entityId: profileRes._id, action: 'create' });
    expect(logs.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Cycle summary endpoint', () => {
  test('GET /api/cycles/:id/summary returns cost/income/profit/costPerKg/categoryActuals', async () => {
    const { token } = await registerAndLogin({ email: 'summary@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'fertilizer', cost: 5000 }] }));

    const res = await request(app)
      .get(`/api/cycles/${cycle._id}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCost).toBe(5000);
    expect(res.body.categoryActuals).toBeDefined();
    expect(res.body.categoryActuals['fertilizer']).toBe(5000);
    expect(typeof res.body.profit).toBe('number');
    expect(typeof res.body.costPerKg).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Min/max amount filter', () => {
  test('minAmount and maxAmount filters work correctly', async () => {
    const { token } = await registerAndLogin({ email: 'minmax@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'seed', cost: 100 }] }));
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'seed', cost: 5000 }] }));
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${token}`)
      .send(await makeExpensePayload(cycle._id, { inputs: [{ categoryTag: 'seed', cost: 10000 }] }));

    const res = await request(app)
      .get('/api/expenses?minAmount=1000&maxAmount=9000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every(e => e.totalAmount >= 1000 && e.totalAmount <= 9000)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Model validation errors → 422 (not 500)', () => {
  test('missing activityCode on a worked-day expense returns 422 VALIDATION_ERROR', async () => {
    const { token } = await registerAndLogin({ email: 'valact@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);

    // Worked day with cost but NO activityCode — model requires it
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        dayStatus: 'worked',
        entryDate: new Date().toISOString(),
        inputs: [{ categoryTag: 'fertilizer', cost: 1000 }],
        machinery: {},
        labour: {},
        other: {},
        // activityCode intentionally omitted
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toBeDefined();
    expect(res.body.error.fields.activityCode).toBeDefined();
  });

  test('fertiliser (British spelling) categoryTag is rejected with 422', async () => {
    const { token } = await registerAndLogin({ email: 'valfert@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id);
    const actCode = await ensureActivityCode();

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        activityCode: actCode,
        dayStatus: 'worked',
        entryDate: new Date().toISOString(),
        inputs: [{ categoryTag: 'fertiliser', cost: 1000 }], // British spelling – invalid
        machinery: {},
        labour: {},
        other: {},
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toBeDefined();
    // The field path from Mongoose is 'inputs.0.categoryTag'
    expect(res.body.error.fields['inputs.0.categoryTag']).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Malformed IDs → 400 INVALID_ID', () => {
  test('POST /api/expenses with malformed cycleId returns 400', async () => {
    const { token } = await registerAndLogin({ email: 'badid@example.com' });
    const actCode = await ensureActivityCode();

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: 'not-a-valid-objectid',
        activityCode: actCode,
        dayStatus: 'worked',
        entryDate: new Date().toISOString(),
        inputs: [{ categoryTag: 'fertilizer', cost: 500 }],
        machinery: {},
        labour: {},
        other: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });
});

