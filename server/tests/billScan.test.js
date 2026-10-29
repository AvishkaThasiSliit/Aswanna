import request from 'supertest';
import app from '../src/app.js';
import { jest } from '@jest/globals';
import { ENV } from '../src/config/env.js';
import { roundToStoredRupees, mapBillServiceToReviewItems } from '../src/services/billMapping.js';

async function registerAndLogin(role = 'farmer') {
  const email = `bill-test-${Date.now()}-${Math.random()}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Bill Scanner Tester',
    email,
    password: 'Password123!',
    role
  });
  return res.body; // { token, user }
}

describe('Bill Scan Route & Mapping Tests (TASK BILL-4 & BILL-4b)', () => {
  let authToken;
  const originalFetch = global.fetch;
  const originalBillScan = ENV.BILL_SCAN;
  const originalToken = ENV.BILL_INTERNAL_TOKEN;
  const originalUrl = ENV.BILL_SERVICE_URL;

  beforeEach(async () => {
    const loginData = await registerAndLogin();
    authToken = loginData.token;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    ENV.BILL_SCAN = originalBillScan;
    ENV.BILL_INTERNAL_TOKEN = originalToken;
    ENV.BILL_SERVICE_URL = originalUrl;
  });

  describe('1. Pure Mapping Unit Tests (TASK BILL-4b)', () => {
    test('roundToStoredRupees handles integer, fractional cents, and zero correctly', () => {
      expect(roundToStoredRupees(1500)).toEqual({ integerAmount: 1500, wasRounded: false });
      expect(roundToStoredRupees('2500')).toEqual({ integerAmount: 2500, wasRounded: false });
      // Fractional cents
      expect(roundToStoredRupees(1250.50)).toEqual({ integerAmount: 1251, wasRounded: true });
      expect(roundToStoredRupees('1250.25')).toEqual({ integerAmount: 1250, wasRounded: true });
      expect(roundToStoredRupees(null)).toEqual({ integerAmount: 0, wasRounded: false });
      expect(roundToStoredRupees('')).toEqual({ integerAmount: 0, wasRounded: false });
    });

    test('mapping returns one row even when items exist', () => {
      const mockBillOutput = {
        status: 'ok',
        vendor: 'Rajarata Agri Mart',
        date: '2026-03-12',
        total: 9000.0,
        items: [
          {
            description: 'Urea 50kg',
            category: 'fertilizer',
            quantity: 1,
            unit: 'bags',
            amount: 4500.0,
            status: 'ok',
            reasons: []
          },
          {
            description: 'MOP 50kg',
            category: 'fertilizer',
            quantity: 1,
            unit: 'bags',
            amount: 4500.0,
            status: 'ok',
            reasons: []
          }
        ]
      };

      const mapped = mapBillServiceToReviewItems(mockBillOutput, '2026-03-12');
      expect(mapped).toHaveLength(1);
      expect(mapped[0].description).toBe('Rajarata Agri Mart');
      expect(mapped[0].category).toBe('fertilizer');
      expect(mapped[0].totalAmount).toBe(9000);
      expect(mapped[0].quantity).toBe(1);
      expect(mapped[0].unitPrice).toBe(9000);
      expect(mapped[0].status).toBe('ok');
    });

    test('total_missing', () => {
      const mockNoTotal = {
        status: 'needs_review',
        vendor: 'Polonnaruwa Traders',
        date: '2026-04-15',
        total: null,
        items: [{ category: 'seed' }],
        reasons: []
      };

      const mapped = mapBillServiceToReviewItems(mockNoTotal);
      expect(mapped).toHaveLength(1);
      expect(mapped[0].description).toBe('Polonnaruwa Traders');
      expect(mapped[0].totalAmount).toBe('');
      expect(mapped[0].unitPrice).toBe('');
      expect(mapped[0].reasons).toContain('total_missing');
      expect(mapped[0].status).toBe('needs_review');
    });

    test('category_unsure with disagreeing items', () => {
      const mockDisagreeing = {
        status: 'ok',
        vendor: 'Mixed Supply Store',
        date: '2026-04-15',
        total: 10000,
        items: [
          { category: 'seed', amount: 4000 },
          { category: 'fertilizer', amount: 6000 }
        ]
      };

      const mapped = mapBillServiceToReviewItems(mockDisagreeing);
      expect(mapped).toHaveLength(1);
      expect(mapped[0].category).toBe('other');
      expect(mapped[0].reasons).toContain('category_unsure');
      expect(mapped[0].status).toBe('needs_review');
    });

    test('amount_rounded', () => {
      const mockFractional = {
        status: 'ok',
        vendor: 'Dambulla Fuel Shed',
        date: '2026-04-15',
        total: 5500.25,
        items: [{ category: 'fuel' }]
      };

      const mapped = mapBillServiceToReviewItems(mockFractional);
      expect(mapped).toHaveLength(1);
      expect(mapped[0].totalAmount).toBe(5500);
      expect(mapped[0].reasons).toContain('amount_rounded');
      expect(mapped[0].status).toBe('needs_review');
    });
  });

  describe('2. Server Route Tests (/api/bill-scan)', () => {
    test('returns 404 when BILL_SCAN is off', async () => {
      ENV.BILL_SCAN = 'off';
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('returns 401 when auth token is missing', async () => {
      ENV.BILL_SCAN = 'on';
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Content-Type', 'image/png')
        .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test('returns 400 for bad content type', async () => {
      ENV.BILL_SCAN = 'on';
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ not: 'an image' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTENT_TYPE');
    });

    test('returns 400 for invalid magic bytes', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = 'test-token';
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(Buffer.from('not real png bytes'));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_BYTES');
    });

    test('returns 413 for oversized file > 5 MB', async () => {
      ENV.BILL_SCAN = 'on';
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .set('Content-Length', `${6 * 1024 * 1024}`)
        .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    test('returns 503 when BILL_INTERNAL_TOKEN is unset', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = '';
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(pngBytes);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('BILL_SERVICE_UNAVAILABLE');
    });

    test('maps upstream down / network error to 503 BILL_SERVICE_DOWN', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = 'valid-token';
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(pngBytes);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('BILL_SERVICE_DOWN');
    });

    test('maps upstream 503 (Tesseract missing) to OCR_ENGINE_MISSING', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = 'valid-token';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Tesseract executable not found' })
      });

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(pngBytes);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('OCR_ENGINE_MISSING');
    });

    test('upstream timeout maps to 504 with { error: { code, message } }', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = 'valid-token';
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(pngBytes);

      expect(res.status).toBe(504);
      expect(res.body).toEqual({
        error: {
          code: 'GATEWAY_TIMEOUT',
          message: 'Bill scanner request timed out'
        }
      });
    });

    test('successfully proxies image and returns mapped items on 200', async () => {
      ENV.BILL_SCAN = 'on';
      ENV.BILL_INTERNAL_TOKEN = 'valid-token';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          vendor: 'Lanka Agro Supplies',
          date: '2026-04-01',
          total: 4500.0,
          items: [
            {
              description: 'Urea 50kg',
              category: 'fertilizer',
              quantity: 1,
              amount: 4500.0,
              status: 'ok',
              reasons: []
            }
          ]
        })
      });

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/bill-scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'image/png')
        .send(pngBytes);

      expect(res.status).toBe(200);
      expect(res.body.vendor).toBe('Lanka Agro Supplies');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].totalAmount).toBe(4500);
      expect(res.body.items[0].category).toBe('fertilizer');
    });
  });
});
