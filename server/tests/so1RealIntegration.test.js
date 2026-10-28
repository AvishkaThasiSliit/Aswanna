import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import mongoose from 'mongoose';

import app from '../src/app.js';
import { Cycle } from '../src/models/Cycle.js';
import { Baseline } from '../src/models/Baseline.js';
import { SO1_CONFIG } from '../../shared/config/so1Mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures/so1');

describe('SO1 Real Code Path Regression Tests (No Fetcher Injections)', () => {
  let originalMode;
  let originalBaseUrl;
  let originalTimeout;
  let token;
  let farmerId;
  let validPaddyFixture;

  beforeAll(async () => {
    originalMode = process.env.SO1_MODE;
    originalBaseUrl = SO1_CONFIG.baseUrl;
    originalTimeout = SO1_CONFIG.timeoutMs;

    validPaddyFixture = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'Paddy_Anuradhapura_Maha_Irrigated.json'), 'utf8')
    );
  });

  afterAll(() => {
    process.env.SO1_MODE = originalMode;
    SO1_CONFIG.baseUrl = originalBaseUrl;
    SO1_CONFIG.timeoutMs = originalTimeout;
  });

  beforeEach(async () => {
    process.env.SO1_MODE = 'real';

    // Register fresh test farmer for each test since afterEach drops collections
    const email = `regtest-${Date.now()}-${Math.random()}@test.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Regression Farmer',
      email,
      password: 'Password123',
    });
    token = regRes.body.token;

    const profRes = await request(app)
      .post('/api/farmer-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Regression Farmer' });
    farmerId = profRes.body._id;
  });

  afterEach(() => {
    SO1_CONFIG.baseUrl = originalBaseUrl;
    SO1_CONFIG.timeoutMs = originalTimeout;
  });

  // (a) SO1_MODE=real with nothing listening on port (connection refused)
  test('(a) connection refused -> activation succeeds, baselineStatus missing, 0 rows, baselineSource null, variance missing_baseline', async () => {
    // Port 59998 has nothing listening
    SO1_CONFIG.baseUrl = 'http://127.0.0.1:59998';

    const res = await request(app)
      .post('/api/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        farmerId,
        crop: 'Paddy',
        season: 'Maha',
        district: 'Anuradhapura',
        extentValue: 1.0,
        extentUnit: 'acre',
        status: 'active',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.baselineStatus).toBe('missing');
    expect(res.body.baselineSource).toBeNull();

    // Verify 0 baseline rows in DB
    const baselineRows = await Baseline.find({ cycleId: res.body._id });
    expect(baselineRows).toHaveLength(0);

    // GET /api/cycles/:id/variance returns missing_baseline
    const varRes = await request(app)
      .get(`/api/cycles/${res.body._id}/variance`)
      .set('Authorization', `Bearer ${token}`);

    expect(varRes.status).toBe(200);
    expect(varRes.body.status).toBe('missing_baseline');
    expect(varRes.body.baselineStatus).toBe('missing');
    expect(varRes.body.baselines).toBeNull();
  });

  // (b) Local stub returning 422 for every attempt (exact -> Whole Island -> extrapolation fails)
  test('(b) 422 on all fallback attempts -> activation succeeds, baselineStatus missing', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Unprocessable Entity - Crop/district combination unsupported' }));
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    SO1_CONFIG.baseUrl = `http://127.0.0.1:${port}`;

    try {
      const res = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerId,
          crop: 'Paddy',
          season: 'Maha',
          district: 'Galle',
          extentValue: 1.0,
          extentUnit: 'acre',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
      expect(res.body.baselineStatus).toBe('missing');
      expect(res.body.baselineSource).toBeNull();

      const baselineRows = await Baseline.find({ cycleId: res.body._id });
      expect(baselineRows).toHaveLength(0);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // (c) Local stub returning bad shape
  test('(c) stub returning malformed payload -> baselineStatus missing', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ predicted_cost: 'not_a_number', cost_breakdown: null }));
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    SO1_CONFIG.baseUrl = `http://127.0.0.1:${port}`;

    try {
      const res = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerId,
          crop: 'Paddy',
          season: 'Maha',
          district: 'Anuradhapura',
          extentValue: 1.0,
          extentUnit: 'acre',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
      expect(res.body.baselineStatus).toBe('missing');
      expect(res.body.baselineSource).toBeNull();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // (d) Timeout
  test('(d) request timeout -> baselineStatus missing', async () => {
    SO1_CONFIG.timeoutMs = 150; // fast timeout
    const server = http.createServer((req, res) => {
      // Intentionally do not respond before timeout
      setTimeout(() => {
        try {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(validPaddyFixture));
        } catch {}
      }, 500);
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    SO1_CONFIG.baseUrl = `http://127.0.0.1:${port}`;

    try {
      const res = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerId,
          crop: 'Paddy',
          season: 'Maha',
          district: 'Anuradhapura',
          extentValue: 1.0,
          extentUnit: 'acre',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
      expect(res.body.baselineStatus).toBe('missing');
      expect(res.body.baselineSource).toBeNull();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // (e) Failure then retry against working stub -> ready with correct rows
  test('(e) failure initially then retry against working stub -> baselineStatus ready with 8 rows', async () => {
    let returnError = true;

    const server = http.createServer((req, res) => {
      if (returnError) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(validPaddyFixture));
      }
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    SO1_CONFIG.baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Initial activation with failing service
      const createRes = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerId,
          crop: 'Paddy',
          season: 'Maha',
          district: 'Anuradhapura',
          extentValue: 1.0,
          extentUnit: 'acre',
          status: 'active',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.baselineStatus).toBe('missing');
      expect(createRes.body.baselineSource).toBeNull();

      // 2. Service recovers
      returnError = false;

      // 3. Retry baseline endpoint
      const retryRes = await request(app)
        .post(`/api/cycles/${createRes.body._id}/retry-baseline`)
        .set('Authorization', `Bearer ${token}`);

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.success).toBe(true);
      expect(retryRes.body.baselineStatus).toBe('ready');
      expect(retryRes.body.rows).toBe(8);
      expect(retryRes.body.cycle.baselineStatus).toBe('ready');
      expect(retryRes.body.cycle.baselineSource).toBe('SO1');

      // 4. Verify 8 rows now in DB
      const baselineRows = await Baseline.find({ cycleId: createRes.body._id });
      expect(baselineRows).toHaveLength(8);

      // 5. Variance endpoint now returns full variance
      const varRes = await request(app)
        .get(`/api/cycles/${createRes.body._id}/variance`)
        .set('Authorization', `Bearer ${token}`);

      expect(varRes.status).toBe(200);
      expect(varRes.body.total.expected).toBe(143523);
      expect(varRes.body.intervalLow).toBe(118870);
      expect(varRes.body.intervalHigh).toBe(173290);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
