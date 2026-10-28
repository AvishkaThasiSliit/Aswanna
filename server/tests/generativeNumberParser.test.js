/**
 * Generative Number Parser Test (TASK V5.4)
 * 
 * 1. Generative test for Sinhala number parser:
 *    Generates every combination of thousands (1-9, 10-14 where present in sinhalaNumberWords.json)
 *    and hundreds (0-9) across every spelling variant in sinhalaNumberWords.json, and asserts exact values.
 * 2. Near-miss tests for Sinhala:
 *    Inserting an unknown token, or dropping a token, inside a number phrase must return null
 *    (amount_unresolved), never a truncated value.
 * 3. Generative test for English number words:
 *    English number words are supported (e.g. 'two thousand five hundred', 'five thousand').
 *    Generates every combination of thousands (1-14) and hundreds (0-9) and asserts exact values.
 * 4. Near-miss tests for English:
 *    Inserting an unknown token or dropping a token returns null / amount_unresolved, never a truncated value.
 */

import {
  parseSinhalaNumberWords,
  parseSinhalaNumberSafe
} from '../../shared/voice/sinhalaNumbers.js';
import {
  parseEnglishNumberWords,
  extractExpenses
} from '../../shared/voice/extractExpenses.js';
import fs from 'node:fs';

const sinhalaWordsData = JSON.parse(
  fs.readFileSync(new URL('../../shared/voice/sinhalaNumberWords.json', import.meta.url), 'utf8')
);

describe('Generative Number Parser Tests (TASK V5.4)', () => {
  describe('Sinhala Generative Combinations (thousands 1-9, 10-14 and hundreds 0-9)', () => {
    const words = sinhalaWordsData.words;

    // Collect thousand variants (1 to 14)
    const thousandVariants = new Map();
    for (let k = 1; k <= 14; k++) thousandVariants.set(k, []);

    // 1. Direct compound thousands from json
    for (const w of words) {
      if (w.value >= 1000 && w.value <= 14000 && w.value % 1000 === 0) {
        const k = w.value / 1000;
        thousandVariants.get(k).push([w.word]);
      }
    }

    // 2. Multiplier forms: digit/teen + multiplier
    const multipliers = words
      .filter(w => w.value === 1000 && ['දහස', 'දහස්', 'දහසක්', 'දාහ', 'දාහක්', 'දාහයි', 'දාස්'].includes(w.word))
      .map(w => w.word);

    for (let k = 1; k <= 14; k++) {
      const baseWords = words
        .filter(w => w.value === k && !multipliers.includes(w.word))
        .map(w => w.word);
      for (const bw of baseWords) {
        for (const mult of multipliers) {
          thousandVariants.get(k).push([bw, mult]);
        }
      }
    }

    // Collect hundred variants (0 to 9)
    const hundredVariants = new Map();
    hundredVariants.set(0, [[]]); // 0 hundred = empty array
    for (let h = 1; h <= 9; h++) {
      const hw = words.filter(w => w.value === h * 100).map(w => w.word);
      hundredVariants.set(h, hw.map(w => [w]));
    }

    test('generates all combinations of thousands (1-14) and hundreds (0-9) and asserts exact values', () => {
      let totalCombinations = 0;

      for (let k = 1; k <= 14; k++) {
        const tList = thousandVariants.get(k);
        expect(tList.length).toBeGreaterThan(0);

        for (let h = 0; h <= 9; h++) {
          const hList = hundredVariants.get(h);
          const expected = k * 1000 + h * 100;

          for (const tTokens of tList) {
            for (const hTokens of hList) {
              const tokens = [...tTokens, ...hTokens];
              const parsed = parseSinhalaNumberWords(tokens);
              expect(parsed).toBe(expected);
              totalCombinations++;
            }
          }
        }
      }

      // Assert significant coverage (thousands * hundreds * variants)
      expect(totalCombinations).toBeGreaterThan(10000);
    });
  });

  describe('Sinhala Near-Miss Tests (unknown or dropped tokens return null / amount_unresolved)', () => {
    test('inserting an unknown token inside a number phrase returns null', () => {
      expect(parseSinhalaNumberWords(['අටදාස්', 'නොදන්නා', 'පන්සියයක්'])).toBeNull();
      expect(parseSinhalaNumberWords(['තුන්දාස්', 'xyz', 'දෙසීයකට'])).toBeNull();
      expect(parseSinhalaNumberWords(['දාහතර', 'foo', 'දහසකට'])).toBeNull();
    });

    test('parseSinhalaNumberSafe returns amount_unresolved on unknown tokens', () => {
      const res = parseSinhalaNumberSafe('අටදාස් නොදන්නා පන්සියයක්');
      expect(res).toEqual({ value: null, reason: 'amount_unresolved' });
    });

    test('extractExpenses returns amount_unresolved and never a truncated value when unknown token is inserted', () => {
      const res = extractExpenses('කුඹුර හාලා දෙන්න ට්‍රැක්ටරේට අටදාස් නොදන්නා පන්සියයක් දුන්නා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].totalAmount).toBeNull();
      expect(res.items[0].status).toBe('needs_review');
      expect(res.items[0].reasons).toContain('amount_unresolved');
    });

    test('extractExpenses returns amount_unresolved with explicit currency and corrupted number word', () => {
      const res = extractExpenses('රුපියල් අටදාස් බ්ලා පන්සියයක් දුන්නා', { lang: 'si' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].totalAmount).toBeNull();
      expect(res.items[0].status).toBe('needs_review');
      expect(res.items[0].reasons).toContain('amount_unresolved');
    });
  });

  describe('English Generative Combinations (thousands 1-14 and hundreds 0-9)', () => {
    const units = [
      '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
      'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'
    ];

    test('English number words are supported: parses all thousands (1-14) and hundreds (0-9)', () => {
      let tested = 0;

      for (let k = 1; k <= 14; k++) {
        const tWord = units[k] + ' thousand';
        for (let h = 0; h <= 9; h++) {
          const hWord = h === 0 ? '' : units[h] + ' hundred';
          const phrase = (tWord + ' ' + hWord).trim();
          const expected = k * 1000 + h * 100;

          const parsed = parseEnglishNumberWords(phrase);
          expect(parsed).toBe(expected);

          // Also verify via extractExpenses with currency cue
          const fullText = `Bought fertilizer for ${phrase} rupees`;
          const extracted = extractExpenses(fullText);
          expect(extracted.items).toHaveLength(1);
          expect(extracted.items[0].totalAmount).toBe(expected);

          tested++;
        }
      }

      expect(tested).toBe(14 * 10);
    });
  });

  describe('English Near-Miss Tests (unknown or dropped tokens return null / amount_unresolved)', () => {
    test('inserting an unknown token inside English number words returns null', () => {
      expect(parseEnglishNumberWords('two thousand blarg five hundred')).toBeNull();
      expect(parseEnglishNumberWords('five thousand foo')).toBeNull();
      expect(parseEnglishNumberWords('two thousand and unknown')).toBeNull();
    });

    test('extractExpenses returns amount_unresolved and never a truncated amount on near-miss', () => {
      // Near miss where 'blarg' breaks the number phrase before rupees
      const res1 = extractExpenses('tractor fee of two thousand blarg five hundred rupees');
      expect(res1.items).toHaveLength(1);
      expect(res1.items[0].totalAmount).toBeNull();
      expect(res1.items[0].status).toBe('needs_review');
      expect(res1.items[0].reasons).toContain('amount_unresolved');

      // Severed number phrase
      const res2 = extractExpenses('paid two thousand blarg rupees for weeding');
      expect(res2.items).toHaveLength(1);
      expect(res2.items[0].totalAmount).toBeNull();
      expect(res2.items[0].status).toBe('needs_review');
      expect(res2.items[0].reasons).toContain('amount_unresolved');
    });

    test('legitimate quantity + currency phrase does not trigger false near-miss', () => {
      // "two bags" is quantity, "five hundred rupees" is money
      const res = extractExpenses('bought two bags of fertilizer for five hundred rupees');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].totalAmount).toBe(500);
      expect(res.items[0].quantity).toBe(2);
      expect(res.items[0].unit).toBe('bags');
    });
  });
});
