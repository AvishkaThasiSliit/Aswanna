import { describe, it, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import fc from 'fast-check';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { Land } from '../src/models/Land.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { Harvest } from '../src/models/Harvest.js';
import { Sale } from '../src/models/Sale.js';
import { ActivityCode } from '../src/models/ActivityCode.js';

import {
  trim,
  collapseWhitespace,
  normalizeNFC,
  sinhalaDigitsToAscii,
  stripThousandsSeparators,
  normalizePhone,
  stripControlChars,
  detectHtml,
  isLeapYear,
  validateNIC,
  validatePhone,
  validateDate,
  validateIntegerRupees,
  validateQuantity,
  validateLandCode,
  validateText,
  validateField,
  validateEntity,
} from '../../shared/validation/index.js';

import { farmerSchema } from '../../shared/formSchemas/farmer.js';
import { machinerySchema } from '../../shared/formSchemas/machinery.js';
import { landSchema } from '../../shared/formSchemas/land.js';
import { cycleSchema } from '../../shared/formSchemas/cycle.js';
import { costSheetSchema } from '../../shared/formSchemas/costSheet.js';
import { harvestSchema } from '../../shared/formSchemas/harvest.js';
import { saleSchema } from '../../shared/formSchemas/sale.js';
import { notesSchema } from '../../shared/formSchemas/notes.js';

describe('SO3 Validation Suite', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PROPERTY-BASED TESTS (fast-check) FOR NORMALIZERS & VALIDATORS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property-Based Tests (fast-check)', () => {
    test('trim and collapseWhitespace produce normalized whitespace without consecutive spaces', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const res = collapseWhitespace(str);
          expect(res).not.toMatch(/\s{2,}/);
          expect(res).toBe(res.trim());
        })
      );
    });

    test('normalizeNFC preserves Sinhala ZWJ (U+200D) and ZWNJ (U+200C)', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          // Add Sinhala consonants joined with ZWJ
          const testStr = str + 'ක්\u200Dෂ'; // k + virama + ZWJ + sha = ksha
          const normalized = normalizeNFC(testStr);
          expect(normalized).toContain('\u200D');
        })
      );
    });

    test('sinhalaDigitsToAscii maps all Sinhala digits to ASCII 0-9', () => {
      fc.assert(
        fc.property(fc.array(fc.integer({ min: 0, max: 9 })), (digits) => {
          const sinhalaDigits = digits.map(d => String.fromCharCode(0x0DE6 + d)).join('');
          const converted = sinhalaDigitsToAscii(sinhalaDigits);
          expect(converted).toBe(digits.join(''));
        })
      );
    });

    test('stripThousandsSeparators removes commas and preserves digit integrity', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000000 }), (num) => {
          const formatted = num.toLocaleString('en-US');
          const stripped = stripThousandsSeparators(formatted);
          expect(Number(stripped)).toBe(num);
        })
      );
    });

    test('stripControlChars removes ASCII control chars while preserving newlines and tabs', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const withControl = str + '\x00\x07\x1F\x7F\n\t';
          const cleaned = stripControlChars(withControl);
          expect(cleaned).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
          expect(cleaned).toContain('\n');
          expect(cleaned).toContain('\t');
        })
      );
    });

    test('validateQuantity accepts any non-negative float within bounds and rejects negatives', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.01, max: 100000, noNaN: true }), (val) => {
          const res = validateQuantity(val, { min: 0, max: 100000 });
          expect(res.isValid).toBe(true);
        })
      );

      fc.assert(
        fc.property(fc.double({ min: -100000, max: -0.01, noNaN: true }), (val) => {
          const res = validateQuantity(val, { min: 0 });
          expect(res.isValid).toBe(false);
          expect(res.errors[0].code).toBe('MIN_VALUE');
        })
      );
    });

    test('validateIntegerRupees accepts non-negative integers and rejects non-integers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000000 }), (val) => {
          const res = validateIntegerRupees(val, { min: 0 });
          expect(res.isValid).toBe(true);
        })
      );

      fc.assert(
        fc.property(fc.double({ min: 1.01, max: 1000, noNaN: true }).filter(n => !Number.isInteger(n)), (val) => {
          const res = validateIntegerRupees(val);
          expect(res.isValid).toBe(false);
          expect(res.errors[0].code).toBe('INTEGER_REQUIRED');
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TABLE-DRIVEN VALIDATION MATRIX PER ENTITY (Unit Level)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Entity Validation Matrix (Unit Tests)', () => {
    // ── Farmer Profile Matrix
    describe('Farmer Profile Entity', () => {
      const validFarmer = {
        name: 'Sunil Shantha',
        dateOfBirth: '1985-05-15',
        nic: '851351234V',
        phone: '0771234567',
        district: 'Kurunegala',
        address: 'No 45, Temple Road, Kurunegala',
      };

      const testCases = [
        { name: 'valid standard case', data: validFarmer, expectedValid: true },
        { name: 'valid old NIC (9 digits + V)', data: { ...validFarmer, nic: '851351234V' }, expectedValid: true },
        { name: 'valid old NIC (9 digits + X)', data: { ...validFarmer, nic: '851351234X' }, expectedValid: true },
        { name: 'valid new NIC (12 digits)', data: { ...validFarmer, dateOfBirth: '1990-08-20', nic: '199023301234' }, expectedValid: true },
        { name: 'valid phone with +94 normalization', data: { ...validFarmer, phone: '+94771234567' }, expectedValid: true },
        { name: 'valid phone with Sinhala digits', data: { ...validFarmer, phone: '෦෭෭෧෨෩෪෫෬෭' }, expectedValid: true },
        { name: 'boundary inside min name length (2 chars)', data: { ...validFarmer, name: 'Ab' }, expectedValid: true },
        { name: 'boundary outside min name length (1 char)', data: { ...validFarmer, name: 'A' }, expectedValid: false, expectedCode: 'MIN_LENGTH' },
        { name: 'empty required name', data: { ...validFarmer, name: '' }, expectedValid: false, expectedCode: 'REQUIRED' },
        { name: 'whitespace-only name', data: { ...validFarmer, name: '   ' }, expectedValid: false, expectedCode: 'REQUIRED' },
        { name: 'invalid NIC format', data: { ...validFarmer, nic: '12345ABC' }, expectedValid: false, expectedCode: 'NIC_FORMAT' },
        { name: 'invalid NIC day range', data: { ...validFarmer, nic: '859991234V' }, expectedValid: false, expectedCode: 'NIC_DAY_RANGE' },
        { name: 'cross-field: NIC birth year mismatch with DOB', data: { ...validFarmer, dateOfBirth: '1992-05-15', nic: '851351234V' }, expectedValid: false, expectedCode: 'NIC_DOB_MISMATCH' },
        { name: 'invalid phone length', data: { ...validFarmer, phone: '077123' }, expectedValid: false, expectedCode: 'PHONE_FORMAT' },
        { name: 'HTML injection rejected in name', data: { ...validFarmer, name: '<script>alert("hack")</script>' }, expectedValid: false, expectedCode: 'HTML_DETECTED' },
        { name: 'HTML injection rejected in address', data: { ...validFarmer, address: '<img src=x onerror=alert(1)>' }, expectedValid: false, expectedCode: 'HTML_DETECTED' },
        { name: 'unknown field rejected in strict mode', data: { ...validFarmer, hackField: 'malicious' }, expectedValid: false, strict: true, expectedCode: 'UNKNOWN_FIELD' },
      ];

      testCases.forEach((tc) => {
        test(`Farmer Matrix: ${tc.name}`, () => {
          const res = validateEntity(farmerSchema, tc.data, { strict: tc.strict ?? false });
          expect(res.isValid).toBe(tc.expectedValid);
          if (!tc.expectedValid && tc.expectedCode) {
            const allCodes = Object.values(res.errors).flat().map(e => e.code);
            expect(allCodes).toContain(tc.expectedCode);
          }
        });
      });
    });

    // ── Machinery Entity Matrix
    describe('Machinery Entity', () => {
      const validMachinery = {
        equipment: '4-Wheel Tractor',
        quantity: 1,
        purchasedOn: { year: 2020, month: 5, day: 10 },
        purchaseValue: 2500000,
        annotationNote: 'Good working condition',
      };

      const testCases = [
        { name: 'valid case', data: validMachinery, expectedValid: true },
        { name: 'boundary inside purchase year 1950', data: { ...validMachinery, purchasedOn: { year: 1950 } }, expectedValid: true },
        { name: 'boundary outside purchase year 1949', data: { ...validMachinery, purchasedOn: { year: 1949 } }, expectedValid: false, expectedCode: 'MIN_VALUE' },
        { name: 'boundary outside purchase year in distant future', data: { ...validMachinery, purchasedOn: { year: 2099 } }, expectedValid: false, expectedCode: 'MAX_VALUE' },
        { name: 'boundary inside min quantity 1', data: { ...validMachinery, quantity: 1 }, expectedValid: true },
        { name: 'boundary outside min quantity 0', data: { ...validMachinery, quantity: 0 }, expectedValid: false, expectedCode: 'MIN_VALUE' },
        { name: 'fractional quantity rejected', data: { ...validMachinery, quantity: 1.5 }, expectedValid: false, expectedCode: 'INTEGER_REQUIRED' },
        { name: 'negative purchase value rejected', data: { ...validMachinery, purchaseValue: -500 }, expectedValid: false, expectedCode: 'MIN_VALUE' },
        { name: 'fractional purchase value rejected', data: { ...validMachinery, purchaseValue: 12500.50 }, expectedValid: false, expectedCode: 'INTEGER_REQUIRED' },
        { name: 'HTML injection rejected in equipment', data: { ...validMachinery, equipment: '<script>alert(1)</script>' }, expectedValid: false, expectedCode: 'HTML_DETECTED' },
        { name: 'unknown field rejected', data: { ...validMachinery, extraProp: true }, expectedValid: false, strict: true, expectedCode: 'UNKNOWN_FIELD' },
      ];

      testCases.forEach((tc) => {
        test(`Machinery Matrix: ${tc.name}`, () => {
          const res = validateEntity(machinerySchema, tc.data, { strict: tc.strict ?? false });
          expect(res.isValid).toBe(tc.expectedValid);
          if (!tc.expectedValid && tc.expectedCode) {
            const allCodes = Object.values(res.errors).flat().map(e => e.code);
            expect(allCodes).toContain(tc.expectedCode);
          }
        });
      });
    });

    // ── Land Entity Matrix
    describe('Land Entity', () => {
      const validLand = {
        landCode: 'L-1',
        landType: 'lowland',
        district: 'Kurunegala',
        tenure: 'freehold',
        extentUnit: 'acre',
        extentValue: 1.5,
        waterSourceType: 'rainfed',
      };

      const testCases = [
        { name: 'valid case rainfed', data: validLand, expectedValid: true },
        { name: 'valid case irrigated with source', data: { ...validLand, waterSourceType: 'irrigated', irrigationSource: 'Mahaweli Canal' }, expectedValid: true },
        { name: 'cross-field: irrigated without irrigationSource rejected', data: { ...validLand, waterSourceType: 'irrigated', irrigationSource: '' }, expectedValid: false, expectedCode: 'REQUIRED' },
        { name: 'landCode valid format L-01.A', data: { ...validLand, landCode: 'L-01.A' }, expectedValid: true },
        { name: 'landCode invalid format with spaces', data: { ...validLand, landCode: 'L 01' }, expectedValid: false, expectedCode: 'LAND_CODE_FORMAT' },
        { name: 'landCode invalid format with special characters', data: { ...validLand, landCode: 'L@01$' }, expectedValid: false, expectedCode: 'LAND_CODE_FORMAT' },
        { name: 'boundary inside extentValue 0.01', data: { ...validLand, extentValue: 0.01 }, expectedValid: true },
        { name: 'boundary outside extentValue 0', data: { ...validLand, extentValue: 0 }, expectedValid: false, expectedCode: 'MIN_VALUE' },
        { name: 'negative extentValue rejected', data: { ...validLand, extentValue: -1 }, expectedValid: false, expectedCode: 'MIN_VALUE' },
        { name: 'invalid enum landType', data: { ...validLand, landType: 'mountain' }, expectedValid: false, expectedCode: 'ENUM_INVALID' },
        { name: 'HTML injection rejected in agrarianServiceCentre', data: { ...validLand, agrarianServiceCentre: '<script>test</script>' }, expectedValid: false, expectedCode: 'HTML_DETECTED' },
        { name: 'unknown field rejected', data: { ...validLand, unknownCol: 123 }, expectedValid: false, strict: true, expectedCode: 'UNKNOWN_FIELD' },
      ];

      testCases.forEach((tc) => {
        test(`Land Matrix: ${tc.name}`, () => {
          const res = validateEntity(landSchema, tc.data, { strict: tc.strict ?? false });
          expect(res.isValid).toBe(tc.expectedValid);
          if (!tc.expectedValid && tc.expectedCode) {
            const allCodes = Object.values(res.errors).flat().map(e => e.code);
            expect(allCodes).toContain(tc.expectedCode);
          }
        });
      });
    });

    // ── Cultivation Cycle Entity Matrix
    describe('Cultivation Cycle Entity', () => {
      const validCycle = {
        crop: 'Tomato',
        season: 'Yala',
        startDate: '2024-04-15',
        extentUnit: 'acre',
        extentValue: 1.0,
      };

      const testCases = [
        { name: 'valid case', data: validCycle, expectedValid: true },
        { name: 'leap day valid date (2024-02-29)', data: { ...validCycle, startDate: '2024-02-29' }, expectedValid: true },
        { name: 'non-leap day invalid date (2023-02-29)', data: { ...validCycle, startDate: '2023-02-29' }, expectedValid: false, expectedCode: 'DATE_INVALID_CALENDAR' },
        { name: '31 June invalid date (2024-06-31)', data: { ...validCycle, startDate: '2024-06-31' }, expectedValid: false, expectedCode: 'DATE_INVALID_CALENDAR' },
        { name: '30 Feb invalid date (2024-02-30)', data: { ...validCycle, startDate: '2024-02-30' }, expectedValid: false, expectedCode: 'DATE_INVALID_CALENDAR' },
        { name: 'invalid season enum', data: { ...validCycle, season: 'Summer' }, expectedValid: false, expectedCode: 'ENUM_INVALID' },
        { name: 'empty startDate rejected', data: { ...validCycle, startDate: '' }, expectedValid: false, expectedCode: 'REQUIRED' },
        { name: 'HTML injection in crop rejected', data: { ...validCycle, crop: '<script>alert(1)</script>' }, expectedValid: false, expectedCode: 'HTML_DETECTED' },
        { name: 'unknown field rejected', data: { ...validCycle, randomKey: 99 }, expectedValid: false, strict: true, expectedCode: 'UNKNOWN_FIELD' },
      ];

      testCases.forEach((tc) => {
        test(`Cycle Matrix: ${tc.name}`, () => {
          const res = validateEntity(cycleSchema, tc.data, { strict: tc.strict ?? false });
          expect(res.isValid).toBe(tc.expectedValid);
          if (!tc.expectedValid && tc.expectedCode) {
            const allCodes = Object.values(res.errors).flat().map(e => e.code);
            expect(allCodes).toContain(tc.expectedCode);
          }
        });
      });
    });

    // ── Harvest & Sale Entities Matrix
    describe('Harvest & Sale Entities', () => {
      const validHarvest = {
        round: 1,
        harvestDate: '2024-07-10',
        yield: 250,
      };

      const validSale = {
        round: 1,
        saleDate: '2024-07-12',
        quantitySold: 200,
        income: 60000,
        soldTo: 'Dambulla Dedicated Economic Centre',
      };

      test('Harvest: valid round', () => {
        const res = validateEntity(harvestSchema, validHarvest, { strict: true });
        expect(res.isValid).toBe(true);
      });

      test('Harvest: yield <= 0 rejected', () => {
        const res = validateEntity(harvestSchema, { ...validHarvest, yield: 0 });
        expect(res.isValid).toBe(false);
        expect(res.errors['yield'][0].code).toBe('MIN_VALUE');
      });

      test('Harvest: unknown field rejected', () => {
        const res = validateEntity(harvestSchema, { ...validHarvest, extraCol: 1 }, { strict: true });
        expect(res.isValid).toBe(false);
        expect(res.errors['_root'][0].code).toBe('UNKNOWN_FIELD');
      });

      test('Sale: valid record', () => {
        const res = validateEntity(saleSchema, validSale, { strict: true });
        expect(res.isValid).toBe(true);
      });

      test('Sale: quantitySold <= 0 rejected', () => {
        const res = validateEntity(saleSchema, { ...validSale, quantitySold: 0 });
        expect(res.isValid).toBe(false);
        expect(res.errors['quantitySold'][0].code).toBe('MIN_VALUE');
      });

      test('Sale: income fractional rupees rejected', () => {
        const res = validateEntity(saleSchema, { ...validSale, income: 5000.75 });
        expect(res.isValid).toBe(false);
        expect(res.errors['income'][0].code).toBe('INTEGER_REQUIRED');
      });

      test('Sale: HTML injection in soldTo rejected', () => {
        const res = validateEntity(saleSchema, { ...validSale, soldTo: '<script>alert(1)</script>' });
        expect(res.isValid).toBe(false);
        expect(res.errors['soldTo'][0].code).toBe('HTML_DETECTED');
      });
    });

    // ── Special Observations & Notes Entity Matrix
    describe('Cycle Notes Entity', () => {
      const validNotes = {
        pestsAndDiseases: 'Minor fruit borer observed',
        otherCropLosses: 'Heavy rains caused slight flower drop',
        areaNotHarvested: 0.1,
        other: 'Recommended fertilizer applied on time',
      };

      test('Notes: valid case', () => {
        const res = validateEntity(notesSchema, validNotes, { strict: true });
        expect(res.isValid).toBe(true);
      });

      test('Notes: negative areaNotHarvested rejected', () => {
        const res = validateEntity(notesSchema, { ...validNotes, areaNotHarvested: -0.5 });
        expect(res.isValid).toBe(false);
        expect(res.errors['areaNotHarvested'][0].code).toBe('MIN_VALUE');
      });

      test('Notes: HTML injection in pestsAndDiseases rejected', () => {
        const res = validateEntity(notesSchema, { ...validNotes, pestsAndDiseases: '<script>alert("xss")</script>' });
        expect(res.isValid).toBe(false);
        expect(res.errors['pestsAndDiseases'][0].code).toBe('HTML_DETECTED');
      });

      test('Notes: unknown field rejected', () => {
        const res = validateEntity(notesSchema, { ...validNotes, unauthorizedTag: true }, { strict: true });
        expect(res.isValid).toBe(false);
        expect(res.errors['_root'][0].code).toBe('UNKNOWN_FIELD');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. API LEVEL INTEGRATION TESTS (422 Shape, Security, Cross-Record & Warnings)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('API Level Validation & Cross-Record Integration', () => {
    let farmerToken;
    let farmerProfile;
    let activeCycle;
    let activityCode;

    beforeEach(async () => {
      // Register test user
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Validation Test User',
        email: `val-${Date.now()}-${Math.random()}@test.lk`,
        password: 'Password123!',
        role: 'farmer',
      });
      farmerToken = regRes.body.token;

      // Ensure Activity Code exists
      const ac = await ActivityCode.create({ code: 'V-01', nameEn: 'Ploughing', nameSi: 'බිම් සකස් කිරීම' });
      activityCode = ac._id.toString();

      // Create Farmer Profile
      const profRes = await request(app)
        .post('/api/farmer-profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: 'Sunil Perera',
          nic: '821234567V',
          phone: '0712345678',
          district: 'Kurunegala',
        });
      farmerProfile = profRes.body;

      // Create Land
      const landRes = await request(app)
        .post('/api/lands')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          landCode: 'VAL-L1',
          landType: 'lowland',
          district: 'Kurunegala',
          tenure: 'freehold',
          extentUnit: 'acre',
          extentValue: 2.0,
          waterSourceType: 'rainfed',
        });

      // Create Active Cycle
      const cycleRes = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          landId: landRes.body._id,
          landCode: 'VAL-L1',
          crop: 'Tomato',
          season: 'Yala',
          district: 'Kurunegala',
          startDate: '2024-04-01',
          extentValue: 2.0,
          extentUnit: 'acre',
          status: 'active',
        });
      activeCycle = cycleRes.body;
    });

    test('API returns strict 422 shape with code VALIDATION_ERROR and fields mapping', async () => {
      const res = await request(app)
        .post('/api/farmer-profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: '', // required empty
          nic: 'bad-nic', // invalid format
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.fields).toBeDefined();
      expect(Array.isArray(res.body.error.fields.name)).toBe(true);
      expect(res.body.error.fields.name[0]).toHaveProperty('code', 'REQUIRED');
      expect(res.body.error.fields.name[0]).toHaveProperty('key');
      expect(res.body.error.fields.name[0]).toHaveProperty('message');
      expect(res.body.stack).toBeUndefined(); // No stack trace to client
    });

    test('API strictly rejects unknown fields with 422 UNKNOWN_FIELD', async () => {
      const res = await request(app)
        .post('/api/farmer-profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: 'Valid Name',
          unauthorizedField: 'malicious injection',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields._root).toBeDefined();
      expect(res.body.error.fields._root[0].code).toBe('UNKNOWN_FIELD');
    });

    test('API rejects HTML script tags in inputs with 422 HTML_DETECTED', async () => {
      const res = await request(app)
        .post('/api/farmer-profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: '<script>alert("xss")</script>',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.name[0].code).toBe('HTML_DETECTED');
    });

    test('Cross-record: enforces unique NIC per farmer (case-insensitive)', async () => {
      // Register second user
      const user2 = await request(app).post('/api/auth/register').send({
        name: 'Farmer Two',
        email: `f2-${Date.now()}@test.lk`,
        password: 'Password123!',
        role: 'farmer',
      });

      // Try to create profile with same NIC (case insensitive)
      const res = await request(app)
        .post('/api/farmer-profile')
        .set('Authorization', `Bearer ${user2.body.token}`)
        .send({
          name: 'Second Farmer',
          nic: '821234567v', // lowercase v matches uppercase V
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.nic[0].code).toBe('DUPLICATE_NIC');
    });

    test('Cross-record: enforces unique land code per farmer (case-insensitive)', async () => {
      const res = await request(app)
        .post('/api/lands')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          landCode: 'val-l1', // already exists as VAL-L1
          landType: 'upland',
          district: 'Kurunegala',
          extentValue: 1.0,
          waterSourceType: 'rainfed',
        });

      expect([409, 422]).toContain(res.status);
      expect(res.body.error.fields.landCode[0].code).toBe('DUPLICATE_LAND_CODE');
    });

    test('Cross-record: enforces one active cycle per land', async () => {
      const res = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          landId: activeCycle.landId,
          crop: 'Chili',
          season: 'Yala',
          startDate: '2024-04-10',
          status: 'active',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.landId[0].code).toBe('LAND_ACTIVE_CYCLE_EXISTS');
    });

    test('Season/start-month mismatch returns warning on cycle creation (HTTP 201)', async () => {
      // Create new land for this cycle
      const land = await Land.create({
        farmerId: farmerProfile.userId || farmerProfile._id,
        landCode: 'L-SEASON-TEST',
        district: 'Kurunegala',
        extentValue: 1,
      });

      // Yala typically starts Mar-May. Start date in November triggers SEASON_MONTH_MISMATCH warning
      const res = await request(app)
        .post('/api/cycles')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          landId: land._id.toString(),
          crop: 'Tomato',
          season: 'Yala',
          startDate: '2024-11-15',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.warnings).toBeDefined();
      expect(res.body.warnings.some(w => w.code === 'SEASON_MONTH_MISMATCH')).toBe(true);
    });

    test('Expense: date outside active cycle startDate rejected with 422', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2023-12-01', // Cycle started 2024-04-01
          dayStatus: 'no_work',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.entryDate[0].code).toBe('DATE_BEFORE_CYCLE');
    });

    test('Expense: conflict between worked and no_work on same date rejected with 422', async () => {
      // Create worked expense
      await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-10',
          dayStatus: 'worked',
          activityCode,
          inputs: [{ categoryTag: 'seed', inputType: 'Tomato seeds', cost: 2500 }],
        });

      // Attempt no_work on same date
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-10',
          dayStatus: 'no_work',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.dayStatus[0].code).toBe('WORKED_STATUS_CONFLICT');
    });

    test('Expense: labour entered without dailyWage rejected with 422', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-15',
          dayStatus: 'worked',
          activityCode,
          labour: { hiredLabour: 2 }, // no dailyWage
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields['labour.dailyWage'][0].code).toBe('WAGE_REQUIRED');
    });

    test('Expense: other amount entered without description rejected with 422', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-15',
          dayStatus: 'worked',
          activityCode,
          other: { amount: 1500 }, // no description
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields['other.description'][0].code).toBe('DESCRIPTION_REQUIRED');
    });

    test('Expense: labour steps not 0.5 rejected with 422', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-15',
          dayStatus: 'worked',
          activityCode,
          labour: { familyLabour: 1.3, dailyWage: 2000 },
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields['labour.familyLabour'][0].code).toBe('LABOUR_STEP_INVALID');
    });

    test('Expense: machinery cost vs unit price x qty warning returned without blocking (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          entryDate: '2024-04-18',
          dayStatus: 'worked',
          activityCode,
          machinery: {
            method: 'Tractor',
            unitPrice: 2000,
            quantity: 2,
            cost: 5000, // 2000 * 2 = 4000 != 5000
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.warnings).toBeDefined();
      expect(res.body.warnings.some(w => w.code === 'MACHINERY_COST_MISMATCH')).toBe(true);
    });

    test('Expense: exact duplicate expense warning returned without blocking', async () => {
      const expenseBody = {
        cycleId: activeCycle._id,
        entryDate: '2024-04-20',
        dayStatus: 'worked',
        activityCode,
        inputs: [{ categoryTag: 'seed', cost: 3000 }],
      };

      // First save
      await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ ...expenseBody, clientRequestId: 'req-1' });

      // Second identical save
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ ...expenseBody, clientRequestId: 'req-2' });

      expect(res.status).toBe(201);
      expect(res.body.warnings).toBeDefined();
      expect(res.body.warnings.some(w => w.code === 'EXACT_DUPLICATE_EXPENSE')).toBe(true);
    });

    test('Sales: sold > harvested and sale date before harvest warnings returned on save (HTTP 201)', async () => {
      // 1. Record Harvest of 100 kg on 2024-06-15
      await request(app)
        .post('/api/harvests')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          round: 1,
          harvestDate: '2024-06-15',
          yield: 100,
        });

      // 2. Record Sale on 2024-06-10 (before first harvest) of 150 kg (sold > harvested)
      const saleRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          round: 1,
          saleDate: '2024-06-10',
          quantitySold: 150,
          income: 45000,
          soldTo: 'Wholesaler',
        });

      expect(saleRes.status).toBe(201);
      expect(saleRes.body.warnings).toBeDefined();
      expect(saleRes.body.warnings.some(w => w.code === 'SOLD_EXCEEDS_HARVEST')).toBe(true);
      expect(saleRes.body.warnings.some(w => w.code === 'SALE_BEFORE_FIRST_HARVEST')).toBe(true);
    });

    test('Cycle Notes: areaNotHarvested <= land extent check', async () => {
      // Land extent is 2.0 acres. areaNotHarvested of 2.5 exceeds land extent.
      const res = await request(app)
        .post('/api/cycle-notes')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          cycleId: activeCycle._id,
          areaNotHarvested: 2.5,
          pestsAndDiseases: 'Heavy pest attack',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.fields.areaNotHarvested[0].code).toBe('AREA_EXCEEDS_LAND_EXTENT');
    });
  });
});
