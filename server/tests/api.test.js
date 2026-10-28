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

// ─────────────────────────────────────────────────────────────────────────────

describe('Setup Wizard Endpoints, Validation & Ownership', () => {
  test('Farmer Profile: validates DOB, NIC, phone format', async () => {
    const { token } = await registerAndLogin({ email: 'setup-prof@example.com' });

    // Invalid future DOB
    const resFuture = await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Saman', dateOfBirth: '2099-01-01' });
    expect(resFuture.status).toBe(422);
    expect(resFuture.body.error.fields.dateOfBirth).toBeDefined();

    // Invalid NIC
    const resNic = await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Saman', nic: 'invalid-nic' });
    expect(resNic.status).toBe(422);
    expect(resNic.body.error.fields.nic).toBeDefined();

    // Invalid phone
    const resPhone = await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Saman', phone: '12345' });
    expect(resPhone.status).toBe(422);
    expect(resPhone.body.error.fields.phone).toBeDefined();

    // Valid profile creation
    const resOk = await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Saman Kumara',
        nic: '199012345678',
        phone: '0771234567',
        district: 'Kurunegala',
        address: 'No 12\nMain St',
      });
    expect(resOk.status).toBe(201);
    expect(resOk.body.name).toBe('Saman Kumara');
  });

  test('Machinery Owned: batch sync and ownership policy', async () => {
    const { token: tokenA } = await registerAndLogin({ email: 'mach-a@example.com' });
    const { token: tokenB } = await registerAndLogin({ email: 'mach-b@example.com' });

    // Create profile A
    const profA = await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Farmer A' });

    // Farmer A saves batch machinery
    const batchRes = await request(app)
      .post('/api/machinery-owned/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          {
            equipment: 'Two-wheel Tractor',
            quantity: 1,
            purchasedOn: { year: 2021, month: 5 },
            purchaseValue: 350000,
            annotationNote: 'Bought second-hand',
          }
        ]
      });
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.items).toHaveLength(1);
    const machId = batchRes.body.items[0]._id;

    // Farmer B cannot access Farmer A's machinery
    const getResB = await request(app)
      .get(`/api/machinery-owned/${machId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([403, 404]).toContain(getResB.status);
  });

  test('Lands: batch sync, duplicate landCode returns 409 with fields, and ownership policy', async () => {
    const { token: tokenA } = await registerAndLogin({ email: 'land-a@example.com' });
    const { token: tokenB } = await registerAndLogin({ email: 'land-b@example.com' });

    // Create profile A
    await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Farmer A' });

    // Batch with duplicate landCode within same submission
    const dupBatchRes = await request(app)
      .post('/api/lands/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          { landCode: 'L-1', landType: 'upland', extentValue: 1, extentUnit: 'acre' },
          { landCode: 'L-1', landType: 'lowland', extentValue: 2, extentUnit: 'acre' },
        ]
      });
    expect(dupBatchRes.status).toBe(409);
    expect(dupBatchRes.body.error.fields.landCode).toBeDefined();

    // Valid batch creation
    const okBatchRes = await request(app)
      .post('/api/lands/batch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          { landCode: 'L-1', landType: 'upland', extentValue: 1, extentUnit: 'acre', tenure: 'freehold', waterSourceType: 'rainfed' },
          { landCode: 'L-2', landType: 'lowland', extentValue: 2, extentUnit: 'hectare', tenure: 'ande', waterSourceType: 'irrigated', irrigationSource: 'Tank' },
        ]
      });
    expect(okBatchRes.status).toBe(200);
    expect(okBatchRes.body.items).toHaveLength(2);
    const land1 = okBatchRes.body.items[0];

    // Single create with duplicate landCode against existing land
    const singleDupRes = await request(app)
      .post('/api/lands')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ landCode: 'L-1', landType: 'upland', extentValue: 1, extentUnit: 'acre' });
    expect(singleDupRes.status).toBe(409);
    expect(singleDupRes.body.error.fields.landCode).toBeDefined();

    // Farmer B cannot access Farmer A's land
    const getLandB = await request(app)
      .get(`/api/lands/${land1._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([403, 404]).toContain(getLandB.status);
  });

  test('Start Cycle: creates active cycle, links land, and sets baselineStatus', async () => {
    const { token } = await registerAndLogin({ email: 'cycle-setup@example.com' });

    // Profile & land
    await request(app)
      .post('/api/farmer-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cycle Farmer' });

    const landRes = await request(app)
      .post('/api/lands/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ landCode: 'L-1', landType: 'lowland', district: 'Kurunegala', extentValue: 1.5, extentUnit: 'acre' }]
      });
    const landId = landRes.body.items[0]._id;

    // Start cycle
    const cycleRes = await request(app)
      .post('/api/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        landId,
        crop: 'Tomato',
        season: 'Yala',
        district: 'Kurunegala',
        status: 'active',
      });
    expect(cycleRes.status).toBe(201);
    expect(cycleRes.body.status).toBe('active');
    expect(cycleRes.body.landCode).toBe('L-1');
    expect(cycleRes.body.extentValue).toBe(1.5);
    expect(['ready', 'missing']).toContain(cycleRes.body.baselineStatus);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Harvest, Sales, Notes, Summary and Calendar Endpoints', () => {
  test('Hand fixture: harvest 500+300kg, sales 40k+22k, cost 17k -> income 62k, profit 45k, costPerKg 21.25', async () => {
    const { token } = await registerAndLogin({ email: 'handfixture@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // 1. Add expense with cost 17000
    const acId = await ensureActivityCode();
    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        entryDate: '2026-04-10',
        activityCode: acId,
        dayStatus: 'worked',
        inputs: [{ inputType: 'fertilizer', categoryTag: 'fertilizer', cost: 17000 }],
        machinery: {},
        labour: {},
        other: {},
      });
    expect(expRes.status).toBe(201);

    // 2. Add harvests: 500 kg and 300 kg (total 800 kg)
    const h1 = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        harvestDate: '2026-05-01',
        yield: 500,
      });
    expect(h1.status).toBe(201);
    expect(h1.body.round).toBe(1);

    const h2 = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        harvestDate: '2026-05-10',
        yield: 300,
      });
    expect(h2.status).toBe(201);
    expect(h2.body.round).toBe(2);

    // 3. Add sales: 40000 rupees and 22000 rupees (total 62000 rupees)
    const s1 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        saleDate: '2026-05-02',
        quantitySold: 400,
        income: 40000,
        soldTo: 'Wholesale Market',
      });
    expect(s1.status).toBe(201);
    expect(s1.body.round).toBe(1);

    const s2 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cycleId: cycle._id,
        saleDate: '2026-05-12',
        quantitySold: 250,
        income: 22000,
        soldTo: 'Retail Shop',
      });
    expect(s2.status).toBe(201);
    expect(s2.body.round).toBe(2);

    // 4. Verify summary calculation
    const summaryRes = await request(app)
      .get(`/api/cycles/${cycle._id}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalCost).toBe(17000);
    expect(summaryRes.body.totalHarvest).toBe(800);
    expect(summaryRes.body.totalIncome).toBe(62000);
    expect(summaryRes.body.profit).toBe(45000);
    expect(summaryRes.body.costPerKg).toBe(21.25);
    expect(summaryRes.body.hasSales).toBe(true);
  });

  test('Warning flag when total sold > total harvested', async () => {
    const { token } = await registerAndLogin({ email: 'warnflag@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // Harvest: 100 kg
    await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, yield: 100 });

    // Sale: 150 kg (sold > harvested)
    const saleRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, quantitySold: 150, income: 15000 });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.warningFlag).toBe(true);
    expect(saleRes.body.soldExceedsHarvest).toBe(true);

    // Summary also reflects warningFlag
    const summaryRes = await request(app)
      .get(`/api/cycles/${cycle._id}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(summaryRes.body.soldExceedsHarvest).toBe(true);
    expect(summaryRes.body.warningFlag).toBe(true);
  });

  test('Ownership isolation: farmer A cannot touch farmer B harvests, sales, or notes', async () => {
    const userA = await registerAndLogin({ email: 'own-farmerA@example.com' });
    const userB = await registerAndLogin({ email: 'own-farmerB@example.com' });

    const profA = await createFarmerProfile(userA.token);
    const cycleA = await createCycle(userA.token, profA._id, { status: 'active', startDate: '2026-04-01' });

    const hA = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ cycleId: cycleA._id, yield: 200 });
    expect(hA.status).toBe(201);

    const sA = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ cycleId: cycleA._id, quantitySold: 100, income: 10000 });
    expect(sA.status).toBe(201);

    const nA = await request(app)
      .post('/api/cycle-notes')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ cycleId: cycleA._id, pestsAndDiseases: 'Leaf curl' });
    expect(nA.status).toBe(201);

    // Farmer B cannot GET or DELETE farmer A's harvest
    const getHB = await request(app)
      .get(`/api/harvests/${hA.body._id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect([403, 404]).toContain(getHB.status);

    const delHB = await request(app)
      .delete(`/api/harvests/${hA.body._id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect([403, 404]).toContain(delHB.status);

    // Farmer B cannot GET farmer A's sale or notes
    const getSB = await request(app)
      .get(`/api/sales/${sA.body._id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect([403, 404]).toContain(getSB.status);

    const getNB = await request(app)
      .get(`/api/cycle-notes/${nA.body._id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect([403, 404]).toContain(getNB.status);
  });

  test('Idempotent POST with clientRequestId on harvest, sales, and notes', async () => {
    const { token } = await registerAndLogin({ email: 'idemp@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // Harvest idempotent
    const hReqId = 'req-harvest-123';
    const h1 = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, yield: 250, clientRequestId: hReqId });
    expect(h1.status).toBe(201);

    const h2 = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, yield: 250, clientRequestId: hReqId });
    expect(h2.status).toBe(200);
    expect(h2.body._id).toBe(h1.body._id);

    // Sale idempotent
    const sReqId = 'req-sale-456';
    const s1 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, quantitySold: 200, income: 20000, clientRequestId: sReqId });
    expect(s1.status).toBe(201);

    const s2 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, quantitySold: 200, income: 20000, clientRequestId: sReqId });
    expect(s2.status).toBe(200);
    expect(s2.body._id).toBe(s1.body._id);

    // Notes idempotent
    const nReqId = 'req-note-789';
    const n1 = await request(app)
      .post('/api/cycle-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, other: 'Initial note', clientRequestId: nReqId });
    expect(n1.status).toBe(201);

    const n2 = await request(app)
      .post('/api/cycle-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, other: 'Initial note', clientRequestId: nReqId });
    expect(n2.status).toBe(200);
    expect(n2.body._id).toBe(n1.body._id);
  });

  test('Soft delete + restore on harvests and sales', async () => {
    const { token } = await registerAndLogin({ email: 'softdel@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // Create harvest & sale
    const h = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, yield: 300 });
    const s = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, quantitySold: 200, income: 25000 });

    // Soft delete harvest
    const delH = await request(app)
      .delete(`/api/harvests/${h.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delH.status).toBe(200);

    // Deleted harvest not in active list
    const listH = await request(app)
      .get(`/api/harvests?cycleId=${cycle._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listH.body.items.some(item => item._id === h.body._id)).toBe(false);

    // Restore harvest
    const restH = await request(app)
      .post(`/api/harvests/${h.body._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restH.status).toBe(200);
    expect(restH.body.deletedAt).toBeNull();

    // Soft delete sale
    const delS = await request(app)
      .delete(`/api/sales/${s.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delS.status).toBe(200);

    // Restore sale
    const restS = await request(app)
      .post(`/api/sales/${s.body._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restS.status).toBe(200);
    expect(restS.body.deletedAt).toBeNull();
  });

  test('Closed-cycle rejection on harvest, sale, notes, and expenses', async () => {
    const { token } = await registerAndLogin({ email: 'closedrej@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // Transition cycle: active -> harvesting -> closed
    await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'harvesting' });
    await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'closed' });

    // Harvest write rejected
    const hRes = await request(app)
      .post('/api/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, yield: 100 });
    expect(hRes.status).toBe(409);
    expect(hRes.body.error.code).toBe('CYCLE_CLOSED');

    // Sale write rejected
    const sRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, quantitySold: 50, income: 5000 });
    expect(sRes.status).toBe(409);
    expect(sRes.body.error.code).toBe('CYCLE_CLOSED');

    // Notes write rejected
    const nRes = await request(app)
      .post('/api/cycle-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, pestsAndDiseases: 'None' });
    expect(nRes.status).toBe(409);
    expect(nRes.body.error.code).toBe('CYCLE_CLOSED');

    // Expense write rejected
    const acId = await ensureActivityCode();
    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycleId: cycle._id, entryDate: '2026-04-10', activityCode: acId, inputs: [] });
    expect(expRes.status).toBe(409);
    expect(expRes.body.error.code).toBe('CYCLE_CLOSED');
  });

  test('Calendar returns months with invalid days (e.g. June day 31 greyed)', async () => {
    const { token } = await registerAndLogin({ email: 'cal-test@example.com' });
    const profile = await createFarmerProfile(token);
    // Cycle starts on 2026-04-01 (April 2026)
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    const calRes = await request(app)
      .get(`/api/cycles/${cycle._id}/calendar`)
      .set('Authorization', `Bearer ${token}`);

    expect(calRes.status).toBe(200);
    expect(calRes.body.months).toBeDefined();
    expect(calRes.body.months.length).toBe(13); // max 13 months as on paper form

    // April has 30 days -> day 31 is invalid
    const april = calRes.body.months.find(m => m.month === 4);
    expect(april).toBeDefined();
    expect(april.invalidDays).toContain(31);

    // June has 30 days -> day 31 is invalid
    const june = calRes.body.months.find(m => m.month === 6);
    expect(june).toBeDefined();
    expect(june.invalidDays).toContain(31);

    // February 2027 has 28 days -> days 29, 30, 31 are invalid
    const feb = calRes.body.months.find(m => m.month === 2);
    expect(feb).toBeDefined();
    expect(feb.invalidDays).toContain(29);
    expect(feb.invalidDays).toContain(30);
    expect(feb.invalidDays).toContain(31);
  });

  test('Double close is idempotent and creates exactly one CropAccuracyHistory', async () => {
    const { token } = await registerAndLogin({ email: 'doubleclose@example.com' });
    const profile = await createFarmerProfile(token);
    const cycle = await createCycle(token, profile._id, { status: 'active', startDate: '2026-04-01' });

    // Transition to harvesting, then closed
    await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'harvesting' });

    const close1 = await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'closed' });
    expect(close1.status).toBe(200);
    expect(close1.body.status).toBe('closed');

    // Second close attempt
    const close2 = await request(app)
      .post(`/api/cycles/${cycle._id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'closed' });
    expect([200, 422]).toContain(close2.status);

    // Verify exactly one CropAccuracyHistory document exists for this cycleId
    const { CropAccuracyHistory } = await import('../src/models/CropAccuracyHistory.js');
    const historyDocs = await CropAccuracyHistory.find({ cycleId: cycle._id });
    expect(historyDocs).toHaveLength(1);
  });
});


