/**
 * Unit Test Suite for Regression Evaluator Matching & Metrics (Phase 4.3)
 *
 * Verifies:
 * 1. A completely correct item (exact category & amount match -> TP)
 * 2. A correct category with an incorrect amount (-> FP + FN)
 * 3. A missing expected item (-> FN)
 * 4. An extra extracted item (-> FP)
 * 5. A duplicate extracted item (one matches, surplus is FP)
 * 6. Multiple items with identical categories (resolved deterministically by amount)
 * 7. An empty extraction (all expected items are FN, P=0%, R=0%, F1=0%)
 * 8. An empty expected list (all extracted items are FP, P=0%, R=0%, F1=0%)
 * 9. Equal-score matching ties (deterministic one-to-one assignment)
 * 10. A case requiring review (save-safe, but not counted as TP unless fields match)
 */

import { describe, test, expect } from '@jest/globals';
import {
  scorePair,
  matchItems,
  normalizeUnitForEval,
  computeDerivedMetrics,
  createLangStats
} from '../eval/regressionEval24.js';

describe('Regression Evaluator Matching & Metric Formulations (Phase 4.3)', () => {

  describe('1. Completely correct item', () => {
    test('pairs exact category and amount as true positive with 100% precision and recall', () => {
      const expected = [{ category: 'fertilizer', totalAmount: 14000, quantity: 2, unit: 'bags' }];
      const extracted = [{ category: 'fertilizer', totalAmount: 14000, quantity: 2, unit: 'bags', status: 'ok', reasons: [] }];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(1);
      expect(matching.unmatchedExpected).toHaveLength(0);
      expect(matching.unmatchedExtracted).toHaveLength(0);

      const pair = matching.pairs[0];
      expect(pair.matchType).toBe('exact_both');

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 1;
      stats.truePositives = 1;
      stats.saveSafeItems = 1;
      stats.saveSafeCases = 1;

      computeDerivedMetrics(stats);
      expect(stats.precision).toBe(100.0);
      expect(stats.recall).toBe(100.0);
      expect(stats.f1).toBe(100.0);
      expect(stats.itemSaveSafetyRate).toBe(100.0);
    });
  });

  describe('2. Correct category with an incorrect amount', () => {
    test('paired row with amount error counts as both FP and FN, reducing precision and recall', () => {
      const expected = [{ category: 'seed', totalAmount: 7500 }];
      const extracted = [{ category: 'seed', totalAmount: 8500, status: 'needs_review', reasons: ['unit_price_fractional'] }];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(1);
      expect(matching.pairs[0].matchType).toBe('category_only');

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 1;
      // Because amount mismatched, it is NOT a true positive:
      stats.falsePositives = 1;
      stats.falseNegatives = 1;
      // It is safe because status is needs_review
      stats.saveSafeItems = 1;
      stats.saveSafeCases = 1;

      computeDerivedMetrics(stats);
      expect(stats.truePositives).toBe(0);
      expect(stats.precision).toBe(0.0);
      expect(stats.recall).toBe(0.0);
      expect(stats.f1).toBe(0.0);
      expect(stats.itemSaveSafetyRate).toBe(100.0);
    });
  });

  describe('3. Missing expected item', () => {
    test('unmatched expected item counts as false negative (recall penalty)', () => {
      const expected = [{ category: 'fuel', totalAmount: 6800 }];
      const extracted = [];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(0);
      expect(matching.unmatchedExpected).toHaveLength(1);
      expect(matching.unmatchedExtracted).toHaveLength(0);

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 0;
      stats.falseNegatives = 1;

      computeDerivedMetrics(stats);
      expect(stats.precision).toBe(0.0);
      expect(stats.recall).toBe(0.0);
      expect(stats.f1).toBe(0.0);
    });
  });

  describe('4. Extra extracted item', () => {
    test('surplus extracted item counts as false positive (precision penalty)', () => {
      const expected = [];
      const extracted = [{ category: 'other', totalAmount: 2500, status: 'ok', reasons: [] }];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(0);
      expect(matching.unmatchedExpected).toHaveLength(0);
      expect(matching.unmatchedExtracted).toHaveLength(1);

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 0;
      stats.extractedItems = 1;
      stats.falsePositives = 1;

      computeDerivedMetrics(stats);
      expect(stats.precision).toBe(0.0);
      expect(stats.recall).toBe(0.0);
      expect(stats.f1).toBe(0.0);
    });
  });

  describe('5. Duplicate extracted item', () => {
    test('when model hallucinates duplicate rows for one expected item, one matches and surplus is FP', () => {
      const expected = [{ category: 'machinery', totalAmount: 8500 }];
      const extracted = [
        { category: 'machinery', totalAmount: 8500, status: 'ok', reasons: [] },
        { category: 'machinery', totalAmount: 8500, status: 'ok', reasons: [] }
      ];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(1);
      expect(matching.unmatchedExtracted).toHaveLength(1);

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 2;
      stats.truePositives = 1;
      stats.falsePositives = 1; // The second duplicate row

      computeDerivedMetrics(stats);
      expect(stats.precision).toBe(50.0); // 1 / 2
      expect(stats.recall).toBe(100.0);   // 1 / 1
      expect(stats.f1).toBe(66.7);
    });
  });

  describe('6. Multiple items with identical categories', () => {
    test('assigns items deterministically by amount to maximize global score', () => {
      const expected = [
        { category: 'fertilizer', totalAmount: 2000 },
        { category: 'fertilizer', totalAmount: 14000 }
      ];
      const extracted = [
        { category: 'fertilizer', totalAmount: 14000 },
        { category: 'fertilizer', totalAmount: 2000 }
      ];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(2);
      expect(matching.unmatchedExpected).toHaveLength(0);
      expect(matching.unmatchedExtracted).toHaveLength(0);

      // Verify each was matched to its exact amount counterpart
      const p1 = matching.pairs.find(p => p.expIndex === 0);
      expect(p1.extracted.totalAmount).toBe(2000);

      const p2 = matching.pairs.find(p => p.expIndex === 1);
      expect(p2.extracted.totalAmount).toBe(14000);
    });
  });

  describe('7. Empty extraction', () => {
    test('handles empty extraction without division-by-zero errors', () => {
      const expected = [{ category: 'seed', totalAmount: 1500 }];
      const extracted = [];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(0);

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 0;
      stats.falseNegatives = 1;

      expect(() => computeDerivedMetrics(stats)).not.toThrow();
      expect(stats.precision).toBe(0);
      expect(stats.recall).toBe(0);
      expect(stats.f1).toBe(0);
    });
  });

  describe('8. Empty expected list', () => {
    test('handles empty expected list gracefully without division-by-zero errors', () => {
      const expected = [];
      const extracted = [{ category: 'labour', totalAmount: 6000 }];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(0);

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 0;
      stats.extractedItems = 1;
      stats.falsePositives = 1;

      expect(() => computeDerivedMetrics(stats)).not.toThrow();
      expect(stats.precision).toBe(0);
      expect(stats.recall).toBe(0);
      expect(stats.f1).toBe(0);
    });
  });

  describe('9. Equal-score matching ties', () => {
    test('resolves ties deterministically across repeated executions', () => {
      const expected = [
        { category: 'labour', totalAmount: 3000 },
        { category: 'labour', totalAmount: 3000 }
      ];
      const extracted = [
        { category: 'labour', totalAmount: 3000 },
        { category: 'labour', totalAmount: 3000 }
      ];

      const res1 = matchItems(expected, extracted);
      const res2 = matchItems(expected, extracted);

      expect(res1.pairs).toHaveLength(2);
      expect(res2.pairs).toHaveLength(2);
      expect(res1.pairs[0].expIndex).toBe(res2.pairs[0].expIndex);
      expect(res1.pairs[0].extIndex).toBe(res2.pairs[0].extIndex);
    });
  });

  describe('10. Case requiring review', () => {
    test('needs_review item with amount mismatch is save-safe, but not counted as TP', () => {
      const expected = [{ category: 'irrigation', totalAmount: 4500 }];
      // Raw transcript had 8502; flagged as needs_review
      const extracted = [{ category: 'irrigation', totalAmount: 8502, status: 'needs_review', reasons: ['amount_implausible'] }];

      const matching = matchItems(expected, extracted);
      expect(matching.pairs).toHaveLength(1);
      expect(matching.pairs[0].matchType).toBe('category_only');

      const stats = createLangStats();
      stats.cases = 1;
      stats.expectedItems = 1;
      stats.extractedItems = 1;
      stats.falsePositives = 1;
      stats.falseNegatives = 1;
      stats.casesRequiringReview = 1;
      stats.saveSafeItems = 1;
      stats.saveSafeCases = 1;

      computeDerivedMetrics(stats);
      expect(stats.truePositives).toBe(0);
      expect(stats.precision).toBe(0.0);
      expect(stats.recall).toBe(0.0);
      expect(stats.itemSaveSafetyRate).toBe(100.0);
      expect(stats.caseSaveSafetyRate).toBe(100.0);
      expect(stats.reviewCoverageRate).toBe(100.0);
    });
  });

  describe('11. Unit Normalization for Evaluation (normalizeUnitForEval)', () => {
    test('normalizes bilingual agricultural units correctly', () => {
      expect(normalizeUnitForEval('මිටි')).toBe('bags');
      expect(normalizeUnitForEval('bags')).toBe('bags');
      expect(normalizeUnitForEval('කිලෝ')).toBe('kg');
      expect(normalizeUnitForEval('kgs')).toBe('kg');
      expect(normalizeUnitForEval('බෝතල්')).toBe('bottle');
      expect(normalizeUnitForEval('bottles')).toBe('bottle');
      expect(normalizeUnitForEval('පැය')).toBe('hours');
      expect(normalizeUnitForEval('hrs')).toBe('hours');
      expect(normalizeUnitForEval('කම්කරුවන්')).toBe('laborers');
      expect(normalizeUnitForEval('laborers')).toBe('laborers');
    });
  });

});
