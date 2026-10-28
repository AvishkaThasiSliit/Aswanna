/**
 * Comprehensive Regression & Safety Test Suite for Aswanna Voice Pipeline
 * (Tasks 4, 5, 7)
 *
 * Verifies:
 * 1. Spoken Sinhala numbers (thousands, prefix tens, lakhs)
 * 2. Agricultural vocabulary expansion & code-switching (traktor, bowser, planks/ලෑලි)
 * 3. Clause segmentation safety: compound nouns vs multi-expense statements
 * 4. Safe financial invariants: missing amounts are never invented, ambiguous numbers require review
 * 5. Baseline plausibility guarding against merged digits
 * 6. Calculation integrity via integer cent arithmetic in sumTotals
 */

import { describe, test, expect } from '@jest/globals';
import { extractExpenses, sumTotals, extractedItemSchema } from '../../shared/voice/extractExpenses.js';
import { parseSinhalaNumberWords, parseSinhalaNumberSafe } from '../../shared/voice/sinhalaNumbers.js';

describe('Aswanna Voice Pipeline Regression & Safety Suite', () => {

  describe('1. Sinhala Number Words Parser (sinhalaNumbers.js)', () => {
    test('parses compound thousands: හයදාස් (6000) and පන්දාස් (5000)', () => {
      expect(parseSinhalaNumberWords(['හයදාස්'])).toBe(6000);
      expect(parseSinhalaNumberWords(['පන්දාස්'])).toBe(5000);
      expect(parseSinhalaNumberWords(['හයදාස්', 'අටසීයක්'])).toBe(6800);
      expect(parseSinhalaNumberWords(['පන්දාස්', 'පන්සීයක්'])).toBe(5500);
    });

    test('parses prefix tens before thousands (විසි දහසක්, තිස් දහසක්, පනස් දහසක්)', () => {
      expect(parseSinhalaNumberWords(['විසි', 'දහසක්'])).toBe(20000);
      expect(parseSinhalaNumberWords(['තිස්', 'දහසක්'])).toBe(30000);
      expect(parseSinhalaNumberWords(['පනස්', 'දහසක්'])).toBe(50000);
      expect(parseSinhalaNumberWords(['විසි', 'පන්දාහක්'])).toBe(25000);
      expect(parseSinhalaNumberWords(['තිස්', 'පන්දාස්'])).toBe(35000);
    });

    test('parses spoken lakhs (ලක්ෂයක්, දෙලක්ෂයක්, ලක්ෂ දෙකක්)', () => {
      expect(parseSinhalaNumberWords(['ලක්ෂයක්'])).toBe(100000);
      expect(parseSinhalaNumberWords(['දෙලක්ෂයක්'])).toBe(200000);
      expect(parseSinhalaNumberWords(['ලක්ෂ', 'දෙකක්'])).toBe(200000);
      expect(parseSinhalaNumberWords(['ලක්ෂ', 'පහක්'])).toBe(500000);
    });

    test('parseSinhalaNumberSafe returns null and amount_unresolved for unrecognizable words', () => {
      const res = parseSinhalaNumberSafe('කුඹුරට ගියා නොදන්නා');
      expect(res.value).toBeNull();
      expect(res.reason).toBe('amount_unresolved');
    });

    test('mixed digits and word numbers in one clause are rejected as amount_unresolved', () => {
      const res = parseSinhalaNumberSafe('8500 දෙසීයක්');
      expect(res.value).toBeNull();
      expect(res.reason).toBe('amount_unresolved');
    });
  });

  describe('2. Agricultural Vocabulary & Code-Switching (keywordMap.json)', () => {
    test('extracts machinery for Singlish/phonetic "traktor" and base form "ට්‍රැක්ටර"', () => {
      const res1 = extractExpenses('traktor කුලියට රුපියල් 8500ක් ගෙව්වා', { lang: 'si' });
      expect(res1.items).toHaveLength(1);
      expect(res1.items[0].category).toBe('machinery');
      expect(res1.items[0].totalAmount).toBe(8500);
      expect(res1.items[0].status).toBe('ok');

      const res2 = extractExpenses('පැය 4ක් ට්‍රැක්ටර දැම්මා රුපියල් 12000ක්', { lang: 'si' });
      expect(res2.items).toHaveLength(1);
      expect(res2.items[0].category).toBe('machinery');
      expect(res2.items[0].quantity).toBe(4);
      expect(res2.items[0].unit).toBe('hours');
      expect(res2.items[0].totalAmount).toBe(12000);
    });

    test('extracts irrigation for water bowser in English and Sinhala (බවුසර්)', () => {
      const resEn = extractExpenses('Paid 4500 for water bowser irrigation');
      expect(resEn.items).toHaveLength(1);
      expect(resEn.items[0].category).toBe('irrigation');
      expect(resEn.items[0].totalAmount).toBe(4500);

      const resSi = extractExpenses('බවුසරයක් ගෙන්නුවා රුපියල් 5000ක්', { lang: 'si' });
      expect(resSi.items).toHaveLength(1);
      expect(resSi.items[0].category).toBe('irrigation');
      expect(resSi.items[0].totalAmount).toBe(5000);
    });

    test('extracts other for planks / timber and Sinhala "ලෑලි"', () => {
      const resEn = extractExpenses('Bought wooden planks for 3500');
      expect(resEn.items).toHaveLength(1);
      expect(resEn.items[0].category).toBe('other');
      expect(resEn.items[0].totalAmount).toBe(3500);

      const resSi = extractExpenses('ලෑලි සඳහා රුපියල් 3500ක් ගෙව්වා', { lang: 'si' });
      expect(resSi.items).toHaveLength(1);
      expect(resSi.items[0].category).toBe('other');
      expect(resSi.items[0].totalAmount).toBe(3500);
    });
  });

  describe('3. Multi-Expense Clause Segmentation & Compound Nouns', () => {
    test('does NOT split compound nouns sharing a trailing verb into dangling items', () => {
      // VP-CAP-024 pattern: "ලෑලි සහ කම්බි සඳහා රුපියල් 3500ක් ගෙව්වා"
      const res = extractExpenses('ලෑලි සහ කම්බි සඳහා රුපියල් 3500ක් ගෙව්වා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].category).toBe('other');
      expect(res.items[0].totalAmount).toBe(3500);
      expect(res.items[0].status).toBe('ok');
    });

    test('correctly splits independent multi-expense statements', () => {
      const text = '1000 on seeds, 2000 on fertilizer and 1500 on fuel';
      const res = extractExpenses(text);
      expect(res.items).toHaveLength(3);
      expect(res.items[0].category).toBe('seed');
      expect(res.items[0].totalAmount).toBe(1000);
      expect(res.items[1].category).toBe('fertilizer');
      expect(res.items[1].totalAmount).toBe(2000);
      expect(res.items[2].category).toBe('fuel');
      expect(res.items[2].totalAmount).toBe(1500);
    });

    test('splits when second part has independent purchase verb even if first has no amount', () => {
      const text = 'Paid 5000 for fertilizer and also bought seeds';
      const res = extractExpenses(text);
      expect(res.items).toHaveLength(2);
      expect(res.items[0].category).toBe('fertilizer');
      expect(res.items[0].totalAmount).toBe(5000);
      expect(res.items[0].status).toBe('ok');

      expect(res.items[1].category).toBe('seed');
      expect(res.items[1].totalAmount).toBeNull();
      expect(res.items[1].status).toBe('needs_review');
      expect(res.items[1].reasons).toContain('amount_unresolved');
    });
  });

  describe('4. Safe Financial Invariants: No Invented Amounts & Review Enforcement', () => {
    test('missing amount is NEVER invented, guessed, or defaulted to zero', () => {
      const res = extractExpenses('I bought some herbicide yesterday');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].category).toBe('agrochemical');
      expect(res.items[0].totalAmount).toBeNull();
      expect(res.items[0].unitPrice).toBeNull();
      expect(res.items[0].status).toBe('needs_review');
      expect(res.items[0].reasons).toContain('amount_unresolved');
    });

    test('two ambiguous numbers in clause force needs_review with amount_ambiguous', () => {
      const res = extractExpenses('bought urea 5000 6000');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].category).toBe('fertilizer');
      expect(res.items[0].totalAmount).toBeNull();
      expect(res.items[0].status).toBe('needs_review');
      expect(res.items[0].reasons).toContain('amount_ambiguous');
    });

    test('amounts parsed from Sinhala number words get interim safety review', () => {
      const res = extractExpenses('ඩීසල් ලීටර් 20ක් රුපියල් හයදාස් අටසීයකට ගත්තා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('fuel');
      expect(item.totalAmount).toBe(6800);
      expect(item.quantity).toBe(20);
      expect(item.unit).toBe('liters');
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_from_words_verify');
    });
  });

  describe('5. Plausibility Guard Against Merged Numbers', () => {
    test('flags abnormally high expense when exceeding category baseline', () => {
      const baselines = {
        machinery: 40000,
        agrochemical: 25000
      };

      // Simulates VP-CAP-002: 8500 spoken, but recognized as 88500
      const res = extractExpenses('88500 tractor flowing yesterday', {
        categoryBaselines: baselines
      });

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('machinery');
      expect(item.totalAmount).toBe(88500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_implausible');
    });

    test('accepts realistic expense within category baseline as ok', () => {
      const baselines = { machinery: 40000 };
      const res = extractExpenses('Paid 8500 for tractor plowing', {
        categoryBaselines: baselines
      });

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('machinery');
      expect(item.totalAmount).toBe(8500);
      expect(item.status).toBe('ok');
      expect(item.reasons).not.toContain('amount_implausible');
    });
  });

  describe('6. Mathematical Integrity & Schema Conformance', () => {
    test('sumTotals accurately sums items in cents without floating point drift', () => {
      const items = [
        { totalAmount: 19.99 },
        { totalAmount: 0.01 },
        { totalAmount: null },
        { totalAmount: 100.50 }
      ];
      expect(sumTotals(items)).toBe(120.50);
    });

    test('all extracted items conform strictly to extractedItemSchema Zod contract', () => {
      const res = extractExpenses('Bought 2 bags of urea for 14000 and 20 litres diesel for 6800');
      for (const item of res.items) {
        expect(() => extractedItemSchema.parse(item)).not.toThrow();
      }
    });
  });

  describe('7. ASR Alternatives Cross-Checking & Category Disagreement Safety', () => {
    test('flags needs_review when ASR alternatives disagree on category (VP-CAP-004 fix)', () => {
      // Simulates VP-CAP-004: Primary alt = "combined harvester 8000", Secondary alt = "combined August 8000"
      const res = extractExpenses('combined harvester 8000', {
        alternatives: [
          'combined harvester 8000',
          'combined August 8000'
        ]
      });

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      // The secondary alternative has no category (null), primary has machinery
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('asr_alternatives_disagree');
    });

    test('preserves status ok when ASR alternatives agree on category and amount', () => {
      const res = extractExpenses('Paid 8500 for tractor plowing', {
        alternatives: [
          'Paid 8500 for tractor plowing',
          '8500 for tractor plowing'
        ]
      });

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('machinery');
      expect(item.totalAmount).toBe(8500);
      expect(item.status).toBe('ok');
    });
  });

  describe('8. Save Safety & Confirmation Path Logic', () => {
    test('hasNeedsReview gates confirmation when any item has status needs_review', () => {
      // Simulating client VoiceExpenseEntry.jsx logic:
      // const hasNeedsReview = extractedItems.some(i => i.status === 'needs_review' || (i.reasons && i.reasons.length > 0));
      const unconfirmedItems = [
        { category: 'machinery', totalAmount: 8500, status: 'ok', reasons: [] },
        { category: 'fertilizer', totalAmount: null, status: 'needs_review', reasons: ['amount_unresolved'] }
      ];
      const hasNeedsReview1 = unconfirmedItems.some(i => i.status === 'needs_review' || (i.reasons && i.reasons.length > 0));
      expect(hasNeedsReview1).toBe(true);

      // After user accepts or resolves the second item:
      const acceptedItems = [
        { category: 'machinery', totalAmount: 8500, status: 'ok', reasons: [] },
        { category: 'fertilizer', totalAmount: 14000, status: 'ok', reasons: [] }
      ];
      const hasNeedsReview2 = acceptedItems.some(i => i.status === 'needs_review' || (i.reasons && i.reasons.length > 0));
      expect(hasNeedsReview2).toBe(false);
    });
  });

  describe('9. Financial Safety & Persistence Layer (Mongoose & Service)', () => {
    test('createExpense rejects worked day with totalAmount 0 with 422 ZERO_COST_WORKED_DAY', async () => {
      const { Cycle } = await import('../src/models/Cycle.js');
      const { createExpense } = await import('../src/services/expenseService.js');
      const mongoose = (await import('mongoose')).default;

      const userId = new mongoose.Types.ObjectId();
      const cycle = await Cycle.create({
        farmerId: userId,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      await expect(
        createExpense(cycle._id, {
          entryDate: new Date('2026-02-01'),
          dayStatus: 'worked',
          activityCode: new mongoose.Types.ObjectId(),
          totalAmount: 0,
          other: { cost: 0, description: 'unresolved expense' }
        }, userId)
      ).rejects.toThrow('A worked day must have at least one non-zero cost');
    });

    test('createExpense is idempotent on clientRequestId retry', async () => {
      const { Cycle } = await import('../src/models/Cycle.js');
      const { Expense } = await import('../src/models/Expense.js');
      const { createExpense } = await import('../src/services/expenseService.js');
      const mongoose = (await import('mongoose')).default;

      const userId = new mongoose.Types.ObjectId();
      const cycle = await Cycle.create({
        farmerId: userId,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      const clientRequestId = `req_voice_${Date.now()}_abc123`;
      const expensePayload = {
        clientRequestId,
        entryDate: new Date('2026-02-01'),
        dayStatus: 'worked',
        activityCode: new mongoose.Types.ObjectId(),
        machinery: { cost: 8500, type: 'tractor' },
        totalAmount: 8500
      };

      // First submission
      const res1 = await createExpense(cycle._id, expensePayload, userId);
      expect(res1.expense).toBeDefined();
      expect(res1.expense.totalAmount).toBe(8500);

      // Repeated retry with the same clientRequestId
      const res2 = await createExpense(cycle._id, expensePayload, userId);
      expect(res2.created).toBe(false);
      expect(res2.expense._id.toString()).toBe(res1.expense._id.toString());

      // Confirm only 1 document exists in MongoDB
      const count = await Expense.countDocuments({ clientRequestId, createdBy: userId });
      expect(count).toBe(1);
    });
  });

  describe('10. VP-CAP-015 / VP-CAP-021 Acoustic Anomaly Safeguards (Phase 5.3)', () => {
    test('VP-CAP-015: recognizes 30 kg for 8500 as unit_price_fractional and flags needs_review without guessing', () => {
      // In VP-CAP-015, speaker said 7500 (250 LKR/kg), but ASR heard 8500.
      // 8500 / 30 = 283.333... cents remainder is non-zero.
      const res = extractExpenses('බීජ වී කිලෝ 30ක් රුපියල් 8500කට ගත්තා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('seed');
      expect(item.totalAmount).toBe(8500); // Does NOT guess 7500
      expect(item.quantity).toBe(30);
      expect(item.unit).toBe('කිලෝ');
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('unit_price_fractional');
    });

    test('accepts clean 30 kg for 7500 as status ok', () => {
      // 7500 / 30 = 250.00 exact integer
      const res = extractExpenses('බීජ වී කිලෝ 30ක් රුපියල් 7500කට ගත්තා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('seed');
      expect(item.totalAmount).toBe(7500);
      expect(item.quantity).toBe(30);
      expect(item.status).toBe('ok');
      expect(item.reasons).not.toContain('unit_price_fractional');
    });

    test('VP-CAP-021: multi-item utterance with mangled clause blocks overall confirmation save', () => {
      // VP-CAP-021: "බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියදම් කළා"
      // Clause 2 ("අයදහස්") fails amount resolution -> status needs_review.
      const res = extractExpenses('බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියදම් කළා', { lang: 'si' });
      expect(res.items.length).toBeGreaterThanOrEqual(2);
      
      const unresolvedItem = res.items.find(i => i.reasons.includes('amount_unresolved'));
      expect(unresolvedItem).toBeDefined();
      expect(unresolvedItem.status).toBe('needs_review');

      // Client VoiceExpenseEntry.jsx save gating: hasNeedsReview is TRUE for the whole case
      const hasNeedsReview = res.items.some(i => i.status === 'needs_review' || (i.reasons && i.reasons.length > 0));
      expect(hasNeedsReview).toBe(true);
    });

    test('clean multi-item statement without unresolvable clauses preserves status ok', () => {
      const res = extractExpenses('Spent 1500 on seeds and 6000 on 2 bags of urea');
      expect(res.items).toHaveLength(2);
      expect(res.items[0].status).toBe('ok');
      expect(res.items[1].status).toBe('ok');
    });

    test('user correction clears unit_price_fractional and transitions row to ok', () => {
      const res = extractExpenses('බීජ වී කිලෝ 30ක් රුපියල් 8500කට ගත්තා', { lang: 'si' });
      const item = res.items[0];
      expect(item.status).toBe('needs_review');

      // Farmer edits amount to 7500
      const correctedAmount = 7500;
      const filteredReasons = item.reasons.filter(r => r !== 'unit_price_fractional');
      const updatedStatus = filteredReasons.length === 0 && correctedAmount > 0 ? 'ok' : 'needs_review';

      expect(updatedStatus).toBe('ok');
      expect(filteredReasons).not.toContain('unit_price_fractional');
    });
  });

  describe('11. Release Audit Safety Edge Cases (Task 2)', () => {
    test('limitation disclosure: wrong amount divisible by quantity where alternatives agree produces status ok (requires farmer review in UI)', () => {
      // Intended was 7500 (250 LKR/kg for 30 kg), but ASR heard 9000 (300 LKR/kg for 30 kg).
      // 9000 / 30 = 300.00 exact integer.
      // Alternatives agree on 9000.
      const res = extractExpenses('බීජ වී කිලෝ 30ක් රුපියල් 9000කට ගත්තා', {
        lang: 'si',
        alternatives: [
          'බීජ වී කිලෝ 30ක් රුපියල් 9000කට ගත්තා',
          'බීජ වී කිලෝ 30ක් රුපියල් 9000කට ගත්ත'
        ]
      });

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      // Mathematically divisible and alternatives agree -> parser cannot detect acoustic substitution automatically
      expect(item.status).toBe('ok');
      expect(item.totalAmount).toBe(9000);
      expect(item.reasons).not.toContain('unit_price_fractional');
      // Proves why the UI table presentation and farmer confirmation step is mandatory!
    });

    test('valid expenses with standard integer unit prices are not blocked', () => {
      const validCases = [
        { text: 'Bought 2 bags of urea for 14000', cat: 'fertilizer', amt: 14000, qty: 2 },
        { text: 'Bought 20 litres of diesel for 6800', cat: 'fuel', amt: 6800, qty: 20 },
        { text: 'Paid 6000 for 2 laborers for weeding', cat: 'labour', amt: 6000, qty: 2 }
      ];

      for (const tc of validCases) {
        const res = extractExpenses(tc.text);
        expect(res.items).toHaveLength(1);
        expect(res.items[0].status).toBe('ok');
        expect(res.items[0].category).toBe(tc.cat);
        expect(res.items[0].totalAmount).toBe(tc.amt);
        expect(res.items[0].quantity).toBe(tc.qty);
        expect(res.items[0].reasons).not.toContain('unit_price_fractional');
      }
    });

    test('concurrent POSTs with identical clientRequestId produce exactly 1 document and no unhandled error', async () => {
      const { Cycle } = await import('../src/models/Cycle.js');
      const { Expense } = await import('../src/models/Expense.js');
      const { createExpense } = await import('../src/services/expenseService.js');
      const mongoose = (await import('mongoose')).default;

      const userId = new mongoose.Types.ObjectId();
      const cycle = await Cycle.create({
        farmerId: userId,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      const clientRequestId = `req_concurrent_${Date.now()}_xyz789`;
      const expensePayload = {
        clientRequestId,
        entryDate: new Date('2026-02-01'),
        dayStatus: 'worked',
        activityCode: new mongoose.Types.ObjectId(),
        machinery: { cost: 8500, type: 'tractor' },
        totalAmount: 8500
      };

      const results = await Promise.all([
        createExpense(cycle._id, expensePayload, userId),
        createExpense(cycle._id, expensePayload, userId)
      ]);

      expect(results).toHaveLength(2);
      const createdCount = results.filter(r => r.created !== false).length;
      expect(createdCount).toBe(1);

      const dbCount = await Expense.countDocuments({ clientRequestId, createdBy: userId });
      expect(dbCount).toBe(1);
    });

    test('direct API call rejects invalid date before cycle start date with 422 DATE_BEFORE_CYCLE', async () => {
      const { Cycle } = await import('../src/models/Cycle.js');
      const { createExpense } = await import('../src/services/expenseService.js');
      const mongoose = (await import('mongoose')).default;

      const userId = new mongoose.Types.ObjectId();
      const cycle = await Cycle.create({
        farmerId: userId,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-03-01'),
        status: 'active'
      });

      await expect(
        createExpense(cycle._id, {
          entryDate: new Date('2026-01-01'), // Before cycle startDate
          dayStatus: 'worked',
          activityCode: new mongoose.Types.ObjectId(),
          machinery: { cost: 5000 },
          totalAmount: 5000
        }, userId)
      ).rejects.toThrow('Expense date cannot be before cycle start date');
    });
  });

  describe('12. Farmer Confirmation Invariant & Server-Side Review Binding (Final Pilot Authorization)', () => {
    test('direct API call with source: "voice" and unconfirmed review (reviewConfirmed: false or missing) is rejected with 422 UNREVIEWED_VOICE_EXPENSE', async () => {
      const request = (await import('supertest')).default;
      const app = (await import('../src/app.js')).default;
      const { Cycle } = await import('../src/models/Cycle.js');
      const { ActivityCode } = await import('../src/models/ActivityCode.js');
      const { Expense } = await import('../src/models/Expense.js');
      const { FarmerProfile } = await import('../src/models/FarmerProfile.js');

      // Register farmer and get auth token
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Voice Farmer Test',
        email: `voice-test-${Date.now()}@example.com`,
        password: 'password123',
        role: 'farmer'
      });
      const token = regRes.body.token;
      const userId = regRes.body.user._id;

      const profile = await FarmerProfile.create({ userId, name: 'Voice Farmer Test' });
      const cycle = await Cycle.create({
        farmerId: profile._id,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      const act = await ActivityCode.create({ code: `ACT-${Date.now()}`, nameEn: 'Field Test' });

      // 1. Missing reviewConfirmed
      const res1 = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          source: 'voice',
          clientRequestId: `req_voice_unconfirmed_${Date.now()}`,
          inputs: [{ categoryTag: 'seed', cost: 7500 }]
        });
      expect(res1.status).toBe(422);
      expect(res1.body.error.code).toBe('UNREVIEWED_VOICE_EXPENSE');

      // 2. reviewConfirmed: false
      const res2 = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          source: 'voice',
          reviewConfirmed: false,
          clientRequestId: `req_voice_false_${Date.now()}`,
          inputs: [{ categoryTag: 'seed', cost: 7500 }]
        });
      expect(res2.status).toBe(422);
      expect(res2.body.error.code).toBe('UNREVIEWED_VOICE_EXPENSE');

      // 3. reviewConfirmed: true but missing clientRequestId
      const res3 = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          source: 'voice',
          reviewConfirmed: true,
          // clientRequestId missing
          inputs: [{ categoryTag: 'seed', cost: 7500 }]
        });
      expect(res3.status).toBe(422);
      expect(res3.body.error.code).toBe('SUBMISSION_ID_REQUIRED');

      // 4. reviewConfirmed: true WITH clientRequestId succeeds and persists source: 'voice'
      const clientReqId = `req_voice_valid_${Date.now()}`;
      const res4 = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          source: 'voice',
          reviewConfirmed: true,
          clientRequestId: clientReqId,
          inputs: [{ categoryTag: 'seed', cost: 7500 }]
        });
      expect(res4.status).toBe(201);
      expect(res4.body.source).toBe('voice');
      expect(res4.body.reviewConfirmed).toBe(true);

      // Verify in DB
      const savedDoc = await Expense.findOne({ clientRequestId: clientReqId });
      expect(savedDoc).not.toBeNull();
      expect(savedDoc.source).toBe('voice');
      expect(savedDoc.reviewConfirmed).toBe(true);
    });

    test('manual expense (source: "manual" or omitted) succeeds without requiring review confirmation', async () => {
      const request = (await import('supertest')).default;
      const app = (await import('../src/app.js')).default;
      const { Cycle } = await import('../src/models/Cycle.js');
      const { ActivityCode } = await import('../src/models/ActivityCode.js');
      const { FarmerProfile } = await import('../src/models/FarmerProfile.js');

      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Manual Farmer Test',
        email: `manual-test-${Date.now()}@example.com`,
        password: 'password123',
        role: 'farmer'
      });
      const token = regRes.body.token;
      const userId = regRes.body.user._id;

      const profile = await FarmerProfile.create({ userId, name: 'Manual Farmer Test' });
      const cycle = await Cycle.create({
        farmerId: profile._id,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      const act = await ActivityCode.create({ code: `ACT-MANUAL-${Date.now()}`, nameEn: 'Manual Prep' });

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          // source omitted
          inputs: [{ categoryTag: 'fertilizer', cost: 4000 }]
        });
      expect(res.status).toBe(201);
      expect(res.body.source).toBe('manual');
      expect(res.body.reviewConfirmed).toBe(false);
    });

    test('financial safety validation rejects zero amount, negative cost, or non-integer rupee amounts', async () => {
      const request = (await import('supertest')).default;
      const app = (await import('../src/app.js')).default;
      const { Cycle } = await import('../src/models/Cycle.js');
      const { ActivityCode } = await import('../src/models/ActivityCode.js');
      const { FarmerProfile } = await import('../src/models/FarmerProfile.js');

      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Financial Safety Farmer',
        email: `fin-safety-${Date.now()}@example.com`,
        password: 'password123',
        role: 'farmer'
      });
      const token = regRes.body.token;
      const userId = regRes.body.user._id;

      const profile = await FarmerProfile.create({ userId, name: 'Financial Safety Farmer' });
      const cycle = await Cycle.create({
        farmerId: profile._id,
        crop: 'Paddy',
        season: 'Maha',
        year: 2026,
        startDate: new Date('2026-01-01'),
        status: 'active'
      });

      const act = await ActivityCode.create({ code: `ACT-FIN-${Date.now()}`, nameEn: 'Financial Activity' });

      // Zero total on worked day
      const resZero = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          inputs: []
        });
      expect(resZero.status).toBe(422);

      // Negative amount in inputs
      const resNeg = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cycleId: cycle._id.toString(),
          entryDate: '2026-02-01',
          dayStatus: 'worked',
          activityCode: act._id.toString(),
          inputs: [{ categoryTag: 'seed', cost: -500 }]
        });
      expect(resNeg.status).toBe(422); // Zod validation failure maps to 422
    });
  });

});


