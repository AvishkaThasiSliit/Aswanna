/**
 * Unit Tests for Deterministic Expense Extractor
 * shared/voice/extractExpenses.js
 */

import { extractExpenses, sumTotals, CANONICAL_CATEGORIES, extractedItemSchema } from '../../shared/voice/extractExpenses.js';
import { ZodError } from 'zod';

describe('Deterministic Voice/Text Expense Extractor (extractExpenses)', () => {

  test('the three-expense example gives three records and a total of exactly 4500.00', () => {
    const text = '1000 on seeds, 2000 on fertilizer and 1500 on fuel';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(3);

    const [seedItem, fertItem, fuelItem] = result.items;

    expect(seedItem.category).toBe('seed');
    expect(seedItem.totalAmount).toBe(1000);
    expect(seedItem.status).toBe('ok');

    expect(fertItem.category).toBe('fertilizer');
    expect(fertItem.totalAmount).toBe(2000);
    expect(fertItem.status).toBe('ok');

    expect(fuelItem.category).toBe('fuel');
    expect(fuelItem.totalAmount).toBe(1500);
    expect(fuelItem.status).toBe('ok');

    const total = sumTotals(result.items);
    expect(total).toBe(4500.00);
  });

  test('20 kg urea for 3000 gives unit price 150/kg', () => {
    const text = '20 kg urea for 3000';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];

    expect(item.category).toBe('fertilizer');
    expect(item.quantity).toBe(20);
    expect(item.unit).toBe('kg');
    expect(item.totalAmount).toBe(3000);
    expect(item.unitPrice).toBe(150);
    expect(item.status).toBe('ok');
    expect(item.reasons).toHaveLength(0);
  });

  test('missing amount gives needs_review', () => {
    const text = 'Bought urea';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];

    expect(item.category).toBe('fertilizer');
    expect(item.totalAmount).toBeNull();
    expect(item.unitPrice).toBeNull();
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_unresolved');
  });

  test('quantity-only number gives needs_review', () => {
    const text = 'Bought 50 kg urea';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];

    expect(item.category).toBe('fertilizer');
    expect(item.quantity).toBe(50);
    expect(item.unit).toBe('kg');
    // Amount must NOT be confused with quantity
    expect(item.totalAmount).toBeNull();
    expect(item.unitPrice).toBeNull();
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_unresolved');
  });

  test('integer-cents sum has no float drift (e.g. 0.1 + 0.2 equivalent cases)', () => {
    const items = [
      { totalAmount: 0.1 },
      { totalAmount: 0.2 }
    ];
    // In native JS float: 0.1 + 0.2 === 0.30000000000000004
    const total = sumTotals(items);
    expect(total).toBe(0.3);

    const items2 = [
      { totalAmount: 19.99 },
      { totalAmount: 0.01 }
    ];
    expect(sumTotals(items2)).toBe(20.00);

    const emptyTotal = sumTotals([]);
    expect(emptyTotal).toBe(0);
  });

  test('negative amount rejected by Zod schema', () => {
    expect(() => {
      extractExpenses('Bought seeds for -500 rupees');
    }).toThrow();
  });

  test('empty string handled gracefully', () => {
    expect(extractExpenses('')).toEqual({ items: [], warnings: [] });
    expect(extractExpenses('   ')).toEqual({ items: [], warnings: [] });
    expect(extractExpenses(null)).toEqual({ items: [], warnings: [] });
    expect(extractExpenses(undefined)).toEqual({ items: [], warnings: [] });
  });

  test('unknown or uncertain category defaults to null with reason category_uncertain', () => {
    const text = 'Bought mysterious gadget for 5000 rupees';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];

    expect(item.category).toBeNull();
    expect(item.totalAmount).toBe(5000);
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('category_uncertain');
  });

  test('parses numbers with commas', () => {
    const text = 'Paid 14,000 rupees for urea fertilizer';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalAmount).toBe(14000);
    expect(result.items[0].category).toBe('fertilizer');
  });

  test('supports English number words for quantities and amounts', () => {
    const text = 'Paid 6000 rupees to two hired laborers for weeding';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('labour');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('laborers');
    expect(item.totalAmount).toBe(6000);
    expect(item.unitPrice).toBe(3000);
  });

  test('parses yesterday and today when today is supplied', () => {
    const text = 'Paid 8500 rupees for tractor plowing yesterday';
    const result = extractExpenses(text, { today: '2026-05-15' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].dateISO).toBe('2026-05-14');
  });

  test('unrecognized Sinhala number words are NOT guessed and set needs_review with amount_unresolved', () => {
    const text = 'යූරියා මිටි දෙකක් ගත්තා රුපියල් ඉන්ගාස්';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('fertilizer');
    expect(item.totalAmount).toBeNull();
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_unresolved');
  });

  test('known Sinhala number words parse correctly into totalAmount with interim needs_review', () => {
    const text = 'යූරියා මිටි දෙකක් රුපියල් දාහතර දහසකට ගත්තා';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('fertilizer');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('bags');
    expect(item.totalAmount).toBe(14000);
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_from_words_verify');
  });

  test('Sinhala suffixed digits keep status ok without amount_from_words_verify', () => {
    const text = 'ට්‍රැක්ටරයට 8500ක් ගෙව්වා';
    const result = extractExpenses(text, { lang: 'si' });
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('machinery');
    expect(item.totalAmount).toBe(8500);
    expect(item.status).toBe('ok');
    expect(item.reasons).not.toContain('amount_from_words_verify');
  });

  test('regression: Paid 12000 for combine harvester hire for 2 hours must give 12000, never 2', () => {
    const text = 'Paid 12000 for combine harvester hire for 2 hours';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('machinery');
    expect(item.totalAmount).toBe(12000);
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('hours');
    expect(item.unitPrice).toBe(6000);
    expect(item.status).toBe('ok');
    expect(item.reasons).toEqual([]);
  });

  test('lone number rule (English): bought 2 bags of urea 6000 accepts 6000 with currency_assumed', () => {
    // Under Task V5 Lone Number Rule: 2 is followed by "bags" (quantity unit),
    // and 6000 is the exactly one standalone number with matched category "fertilizer".
    // It is accepted as ok with informational reason 'currency_assumed'.
    const text = 'bought 2 bags of urea 6000';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('fertilizer');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('bags');
    expect(item.totalAmount).toBe(6000);
    expect(item.status).toBe('ok');
    expect(item.reasons).toContain('currency_assumed');
  });

  test('lone number rule (English): two or more standalone numbers without currency cue remain needs_review', () => {
    const text = 'bought urea 5000 6000';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('fertilizer');
    expect(item.totalAmount).toBeNull();
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_ambiguous');
  });

  test('regression: 6000 for 2 bags of urea gives 6000 with unit price 3000', () => {
    const text = '6000 for 2 bags of urea';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.category).toBe('fertilizer');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('bags');
    expect(item.totalAmount).toBe(6000);
    expect(item.unitPrice).toBe(3000);
    expect(item.status).toBe('ok');
    expect(item.reasons).toEqual([]);
  });

  test('regression: multiple candidate amounts without explicit currency cue set needs_review with amount_ambiguous', () => {
    const text = 'Paid 5000 or 4000 for fertilizer';
    const result = extractExpenses(text);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.totalAmount).toBeNull();
    expect(item.status).toBe('needs_review');
    expect(item.reasons).toContain('amount_ambiguous');
  });

  describe('Implausible Amounts & Baselines (TASK V5)', () => {
    test('exceeding category baseline flags needs_review with amount_implausible', () => {
      const text = 'Bought urea for 45000 rupees';
      const result = extractExpenses(text, { categoryBaselines: { fertilizer: 31200 } });
      expect(result.items[0].status).toBe('needs_review');
      expect(result.items[0].reasons).toContain('amount_implausible');
    });

    test('exceeding total baseline flags needs_review with amount_implausible', () => {
      const text = 'Paid 160000 rupees for machinery hire';
      const result = extractExpenses(text, { totalBaseline: 150000 });
      expect(result.items[0].status).toBe('needs_review');
      expect(result.items[0].reasons).toContain('amount_implausible');
    });

    test('exceeding default 500k without baselines flags needs_review with amount_implausible', () => {
      const text = 'Bought compost for 750001';
      const result = extractExpenses(text);
      expect(result.items[0].status).toBe('needs_review');
      expect(result.items[0].reasons).toContain('amount_implausible');
    });
  });

  describe('ASR Alternatives Cross-Check (TASK V5)', () => {
    test('flags needs_review with asr_alternatives_disagree when amounts disagree across alternatives', () => {
      const text = 'යුරියා මිටි දෙකක් රුපියල් දාහතර දහසකට ගත්තා';
      const alternatives = [
        'යුරියා මිටි දෙකක් රුපියල් දාහතර දහසකට ගත්තා',
        'යුරියා මිටි දෙකක් රුපියල් 14කට ගත්තා'
      ];
      const result = extractExpenses(text, { lang: 'si', alternatives });
      expect(result.items[0].status).toBe('needs_review');
      expect(result.items[0].reasons).toContain('asr_alternatives_disagree');
    });

    test('remains ok when amounts agree across alternatives', () => {
      const text = 'Paid 8500 for tractor provin yesterday';
      const alternatives = [
        'Paid 8500 for tractor provin yesterday',
        'Paid 8500 for tractor province yesterday'
      ];
      const result = extractExpenses(text, { lang: 'en', alternatives });
      expect(result.items[0].status).toBe('ok');
      expect(result.items[0].reasons).not.toContain('asr_alternatives_disagree');
    });
  });

  test('all 8 canonical categories are strictly supported', () => {
    expect(CANONICAL_CATEGORIES).toEqual([
      'seed',
      'fertilizer',
      'agrochemical',
      'labour',
      'machinery',
      'fuel',
      'irrigation',
      'other'
    ]);
  });

  describe('TASK V5.2: Plural Keywords, Transport, and Sinhala Irrigation', () => {
    test('matches simple English plural/suffix forms (weedicides, herbicides, labourers, bags)', () => {
      // 1. weedicides -> agrochemical
      const res1 = extractExpenses('Paid 3200 for weedicides');
      expect(res1.items[0].category).toBe('agrochemical');
      expect(res1.items[0].totalAmount).toBe(3200);

      // 2. herbicides -> agrochemical
      const res2 = extractExpenses('Spent 4500 on herbicides');
      expect(res2.items[0].category).toBe('agrochemical');
      expect(res2.items[0].totalAmount).toBe(4500);

      // 3. labourers -> labour
      const res3 = extractExpenses('Paid 6000 to hired labourers');
      expect(res3.items[0].category).toBe('labour');
      expect(res3.items[0].totalAmount).toBe(6000);

      // 4. gunny bags -> other
      const res4 = extractExpenses('Bought gunny bags for 1500');
      expect(res4.items[0].category).toBe('other');
      expect(res4.items[0].totalAmount).toBe(1500);
    });

    test('unrelated words are strictly NOT matched to categories', () => {
      // baggage should not match bag / gunny bags
      const resBaggage = extractExpenses('Paid 5000 for baggage');
      expect(resBaggage.items[0].category).toBeNull();
      expect(resBaggage.items[0].reasons).toContain('category_uncertain');

      // bagel should not match bag
      const resBagel = extractExpenses('Spent 500 on bagel');
      expect(resBagel.items[0].category).toBeNull();
      expect(resBagel.items[0].reasons).toContain('category_uncertain');

      // laborious should not match labourer / labour
      const resLaborious = extractExpenses('Paid 5000 for laborious activity');
      expect(resLaborious.items[0].category).toBeNull();
      expect(resLaborious.items[0].reasons).toContain('category_uncertain');

      // weed should not match weedicide
      const resWeed = extractExpenses('Paid 3000 for weed');
      expect(resWeed.items[0].category).toBeNull();
      expect(resWeed.items[0].reasons).toContain('category_uncertain');
    });

    test('transport maps to other with category_uncertain reason kept', () => {
      const res = extractExpenses('spend 2500 transport bags and binding jobs', { lang: 'en' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('other');
      expect(item.totalAmount).toBe(2500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('category_uncertain');
    });

    test('Sinhala term ජල සම්පාදනය maps to irrigation', () => {
      const res = extractExpenses('ජල සම්පාදනය සඳහා රුපියල් 4500ක් ගෙව්වා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('irrigation');
      expect(item.totalAmount).toBe(4500);
      expect(item.status).toBe('ok');
    });
  });

  describe('TASK V5.3: Sinhala Number Parsing & Full Grammar Consumption', () => {
    test('regression VP-SI-012: අටදාස් පන්සියයක් gives 8500 (never 8000) with amount_from_words_verify', () => {
      const text = 'කුඹුර හාලා දෙන්න ට්‍රැක්ටරේට අටදාස් පන්සියයක් දුන්නා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('machinery');
      expect(item.totalAmount).toBe(8500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_from_words_verify');
    });

    test('regression VP-SI-017: දෙදහස් පන්සියයක් gives 2500 (never 2000) with amount_from_words_verify', () => {
      const text = 'ඇලෙන් වතුර හරවන්න වාරිමාර්ග ගාස්තුව දෙදහස් පන්සියයක් ගෙව්වා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('irrigation');
      expect(item.totalAmount).toBe(2500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_from_words_verify');
    });

    test('regression VP-SI-022: දෙදහස් පන්සියයක් in labour context gives 2500 (never 2000)', () => {
      const text = 'පෝර ඉහින්න ආපු කුලී කම්කරුවාට දවසේ කුලිය දෙදහස් පන්සියයක් දුන්නා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('labour');
      expect(item.totalAmount).toBe(2500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_from_words_verify');
    });

    test('regression VP-SI-023: හාරදාස් පන්සියයක් gives 4500 (never 4000) with amount_from_words_verify', () => {
      const text = 'කනුවක් හිටවන්න සහ වැට බඳින්න කම්බි වලට හාරදාස් පන්සියයක් ගියා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('other');
      expect(item.totalAmount).toBe(4500);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_from_words_verify');
    });

    test('strict consumption: unknown token inside number phrase gives null and amount_unresolved', () => {
      const text = 'කුඹුර හාලා දෙන්න ට්‍රැක්ටරේට අටදාස් ඉන්ගාස් පන්සියයක් දුන්නා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.totalAmount).toBeNull();
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_unresolved');
    });

    test('strict consumption: leftover token between number and stop verb gives null and amount_unresolved', () => {
      const text = 'ට්‍රැක්ටරේට අටදාස් නොදන්නා දුන්නා';
      const res = extractExpenses(text, { lang: 'si' });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.totalAmount).toBeNull();
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('amount_unresolved');
    });
  });

  describe('TASK V6: Real ASR alternatives cross-check tests', () => {
    test('VP-CAP-020: 400 vs 4500 alternatives disagree -> flagged asr_alternatives_disagree', () => {
      const text = 'ජල සම්පාදනය සඳහා රුපියල් 400ක් ගෙව';
      const alternatives = [
        { transcript: 'ජල සම්පාදනය සඳහා රුපියල් 400ක් ගෙව', confidence: null },
        { transcript: 'ජල සම්පාදනය සඳහා රුපියල් 4500ක් ගෙව', confidence: null },
        { transcript: 'ජල සම්පාදනය සඳහා රුපියල් හාරදහස් පන්සියයක් ගෙව', confidence: null }
      ];
      const res = extractExpenses(text, { lang: 'si', alternatives });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('irrigation');
      expect(item.totalAmount).toBe(400);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('asr_alternatives_disagree');
    });

    test('VP-CAP-023: 48 vs 4800 alternatives disagree -> flagged asr_alternatives_disagree', () => {
      const text = 'කෘමි නාශක බෝතල් දෙකක් රුපියල් 48කට ගත්තා';
      const alternatives = [
        { transcript: 'කෘමි නාශක බෝතල් දෙකක් රුපියල් 48කට ගත්තා', confidence: null },
        { transcript: 'කෘමි නාශක බෝතල් දෙකක් රුපියල් 48කට ගත්ත', confidence: null },
        { transcript: 'කෘමි නාශක බෝතල් දෙකක් රුපියල් 4800කට ගත්තා', confidence: null }
      ];
      const res = extractExpenses(text, { lang: 'si', alternatives });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('agrochemical');
      expect(item.totalAmount).toBe(48);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('asr_alternatives_disagree');
    });

    test('VP-CAP-007: 86000 vs 8000 alternatives disagree -> flagged asr_alternatives_disagree', () => {
      const text = '86000 for two labourers 480';
      const alternatives = [
        { transcript: '86000 for two labourers 480', confidence: null },
        { transcript: '8000 for two labourers 480', confidence: null },
        { transcript: '86000 for two labourers for video', confidence: null }
      ];
      const res = extractExpenses(text, { lang: 'en', alternatives });
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.category).toBe('labour');
      expect(item.totalAmount).toBe(86000);
      expect(item.status).toBe('needs_review');
      expect(item.reasons).toContain('asr_alternatives_disagree');
    });

    test('VP-CAP-005: multi-item phrase with alternative differing in amount -> flagged asr_alternatives_disagree', () => {
      const text = 'spend 105000 feet paddy and 6000 or two bags of urea';
      const alternatives = [
        { transcript: 'spend 105000 feet paddy and 6000 or two bags of urea', confidence: null },
        { transcript: 'spend 105000 feet paddy and 600002 bags of urea', confidence: null },
        { transcript: 'spend 105000 feet Padi and 6000 or two bags of urea', confidence: null }
      ];
      const res = extractExpenses(text, { lang: 'en', alternatives });
      expect(res.items).toHaveLength(2);
      expect(res.items[0].status).toBe('needs_review');
      expect(res.items[0].reasons).toContain('asr_alternatives_disagree');
      expect(res.items[1].status).toBe('needs_review');
      expect(res.items[1].reasons).toContain('asr_alternatives_disagree');
    });

    test('VP-CAP-021: all alternatives identically produce 1900 -> NOT flagged asr_alternatives_disagree', () => {
      const text = 'බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියලම කළා';
      const alternatives = [
        { transcript: 'බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියලම කළා', confidence: null },
        { transcript: 'බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියලුම කළා', confidence: null },
        { transcript: 'බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියලම කළ', confidence: null }
      ];
      const res = extractExpenses(text, { lang: 'si', alternatives });
      expect(res.items).toHaveLength(2);
      const seedItem = res.items[0];
      expect(seedItem.category).toBe('seed');
      expect(seedItem.totalAmount).toBe(1900);
      expect(seedItem.reasons).not.toContain('asr_alternatives_disagree');
      expect(seedItem.status).toBe('ok');
    });
  });
});

