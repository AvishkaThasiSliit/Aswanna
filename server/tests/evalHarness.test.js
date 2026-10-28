/**
 * evalHarness.test.js – Unit tests for evaluation harness components.
 *
 * Validates:
 *   1. Production engine vs independent reference engine on exact boundaries (7%, 10%, 12%, 15%)
 *   2. Proposal Baseline (Section 3.3 binary rule: variance > 0) and Extra Flat-10% Baseline
 *   3. Zero-baseline and negative variance handling
 *   4. Exact agreement across all synthetic fixtures (including the 4 discriminating scenarios)
 *   5. Phasing curve monotonicity and end-of-cycle values (referenceEngine.js lines 25-60)
 *   6. Crop ranking determinism and stability
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { computeVariance, computeTier, DEFAULT_THRESHOLDS } from '../../shared/variance.js';
import { computeCropRanking } from '../../shared/ranking.js';
import {
  refComputeVariance,
  refComputeTier,
  refPhasingFor,
  compareEngineWithReference,
  REF_CURVE_CONFIG,
  REF_VOLATILE_CATEGORIES,
  REF_STABLE_CATEGORIES,
} from '../eval/referenceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../eval/fixtures');

describe('Evaluation Harness Unit Tests', () => {
  // ── 1. Volatile Boundaries: 7% and 12% ─────────────────────────────────────
  describe('Volatile Category Boundaries (7% and 12%)', () => {
    test('volatile 7% lower boundary (below, exact, above)', () => {
      // 6.99% -> normal
      expect(computeTier(0.0699, 'seed')).toBe('normal');
      expect(refComputeTier(0.0699, 'seed')).toBe('normal');

      // 7.00% -> normal (inclusive threshold <= 0.07)
      expect(computeTier(0.0700, 'seed')).toBe('normal');
      expect(refComputeTier(0.0700, 'seed')).toBe('normal');

      // 7.01% -> attention
      expect(computeTier(0.0701, 'seed')).toBe('attention');
      expect(refComputeTier(0.0701, 'seed')).toBe('attention');
    });

    test('volatile 12% upper boundary (below, exact, above)', () => {
      // 11.99% -> attention
      expect(computeTier(0.1199, 'fertilizer')).toBe('attention');
      expect(refComputeTier(0.1199, 'fertilizer')).toBe('attention');

      // 12.00% -> attention (inclusive threshold <= 0.12)
      expect(computeTier(0.1200, 'fertilizer')).toBe('attention');
      expect(refComputeTier(0.1200, 'fertilizer')).toBe('attention');

      // 12.01% -> significant
      expect(computeTier(0.1201, 'fertilizer')).toBe('significant');
      expect(refComputeTier(0.1201, 'fertilizer')).toBe('significant');
    });
  });

  // ── 2. Stable Boundaries: 10% and 15% ──────────────────────────────────────
  describe('Stable Category Boundaries (10% and 15%)', () => {
    test('stable 10% lower boundary (below, exact, above)', () => {
      // 9.99% -> normal
      expect(computeTier(0.0999, 'labour')).toBe('normal');
      expect(refComputeTier(0.0999, 'labour')).toBe('normal');

      // 10.00% -> normal (inclusive threshold <= 0.10)
      expect(computeTier(0.1000, 'labour')).toBe('normal');
      expect(refComputeTier(0.1000, 'labour')).toBe('normal');

      // 10.01% -> attention
      expect(computeTier(0.1001, 'labour')).toBe('attention');
      expect(refComputeTier(0.1001, 'labour')).toBe('attention');
    });

    test('stable 15% upper boundary (below, exact, above)', () => {
      // 14.99% -> attention
      expect(computeTier(0.1499, 'machinery')).toBe('attention');
      expect(refComputeTier(0.1499, 'machinery')).toBe('attention');

      // 15.00% -> attention (inclusive threshold <= 0.15)
      expect(computeTier(0.1500, 'machinery')).toBe('attention');
      expect(refComputeTier(0.1500, 'machinery')).toBe('attention');

      // 15.01% -> significant
      expect(computeTier(0.1501, 'machinery')).toBe('significant');
      expect(refComputeTier(0.1501, 'machinery')).toBe('significant');
    });
  });

  // ── 3. Proposal Baseline (Section 3.3) & Extra Flat-10% Baseline ───────────
  describe('Proposal Baseline (Section 3.3) & Extra Flat-10% Baseline', () => {
    test('proposal baseline: binary alert when variance > 0, normal when <= 0', () => {
      const baselineCfg = { mode: 'single', single: 0 };

      // Negative or zero variance -> normal
      expect(computeTier(-0.05, 'seed', baselineCfg)).toBe('normal');
      expect(refComputeTier(-0.05, 'seed', 'single')).toBe('normal');
      expect(computeTier(0.0, 'seed', baselineCfg)).toBe('normal');
      expect(refComputeTier(0.0, 'seed', 'single')).toBe('normal');

      // Any positive variance -> triggers alert (significant)
      expect(computeTier(0.0001, 'seed', baselineCfg)).toBe('significant');
      expect(refComputeTier(0.0001, 'seed', 'single')).toBe('significant');

      expect(computeTier(0.08, 'labour', baselineCfg)).toBe('significant');
      expect(refComputeTier(0.08, 'labour', 'single')).toBe('significant');
    });

    test('extra baseline variant: flat 10% threshold boundary', () => {
      const flat10Cfg = { mode: 'single', single: 0.10 };

      expect(computeTier(0.0999, 'seed', flat10Cfg)).toBe('normal');
      expect(refComputeTier(0.0999, 'seed', 'flat_10')).toBe('normal');

      expect(computeTier(0.1000, 'seed', flat10Cfg)).toBe('normal');
      expect(refComputeTier(0.1000, 'seed', 'flat_10')).toBe('normal');

      expect(computeTier(0.1001, 'seed', flat10Cfg)).toBe('significant');
      expect(refComputeTier(0.1001, 'seed', 'flat_10')).toBe('significant');
    });
  });

  // ── 4. Zero Baseline and Underspend Guards ──────────────────────────────────
  describe('Zero Baseline & Underspend Guards', () => {
    test('negative variance evaluates to normal in both implementations', () => {
      expect(computeTier(-0.25, 'fertilizer')).toBe('normal');
      expect(refComputeTier(-0.25, 'fertilizer')).toBe('normal');

      expect(computeTier(-0.01, 'labour')).toBe('normal');
      expect(refComputeTier(-0.01, 'labour')).toBe('normal');
    });

    test('zero baseline with positive spend triggers attention with no_baseline reason', () => {
      const baselines = { irrigation: { expected: 0 } };
      const actuals = { irrigation: 8000 };

      const engineRes = computeVariance({
        baselines,
        actuals,
        dayOfCycle: 20,
        cycleLength: 100,
      });

      const refRes = refComputeVariance({
        baselines,
        actuals,
        dayOfCycle: 20,
        cycleLength: 100,
      });

      expect(engineRes.categories.irrigation.tier).toBe('attention');
      expect(engineRes.categories.irrigation.reason).toBe('no_baseline');

      expect(refRes.categories.irrigation.tier).toBe('attention');
      expect(refRes.categories.irrigation.reason).toBe('no_baseline');
    });
  });

  // ── 5. Full Fixtures Exact Agreement ───────────────────────────────────────
  describe('Full Fixture Exact Agreement Across All 10 Scenarios', () => {
    const fixtureFiles = [
      'on_track.json',
      'mild_overspend.json',
      'significant_overspend.json',
      'late_season_spike.json',
      'underspend.json',
      'zero_baseline.json',
      'drift_volatile.json',
      'drift_stable.json',
      'exact_boundaries.json',
      'temporary_spike_resolving.json',
    ];

    test.each(fixtureFiles)('fixture %s achieves 100% agreement between engine and reference', filename => {
      const fullPath = path.join(FIXTURES_DIR, filename);
      const fixture = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      expect(fixture.disclaimer).toBe('SYNTHETIC: replace with DoA field data');

      for (const event of fixture.expectedAlertEvents) {
        const engineRes = computeVariance({
          baselines: fixture.baselines,
          actuals: { [event.category]: event.actualToDate },
          dayOfCycle: event.day,
          cycleLength: fixture.cycle.cycleLength,
        });

        const refRes = refComputeVariance({
          baselines: fixture.baselines,
          actuals: { [event.category]: event.actualToDate },
          dayOfCycle: event.day,
          cycleLength: fixture.cycle.cycleLength,
          mode: 'tiered',
        });

        const comparison = compareEngineWithReference(engineRes, refRes);
        expect(comparison.agreement).toBe(true);
        expect(comparison.diffs).toHaveLength(0);

        // Also assert against hand-labelled ground truth tier
        expect(engineRes.categories[event.category].tier).toBe(event.tier);
      }
    });
  });

  // ── 6. Phasing Curves Monotonicity & End-of-Cycle Values ────────────────────
  describe('Phasing Curves Monotonicity & End-of-Cycle Values (referenceEngine.js lines 25-60)', () => {
    test('all curves in REF_CURVE_CONFIG are strictly monotonic in time fraction and non-decreasing in cumulative spend', () => {
      for (const [curveName, points] of Object.entries(REF_CURVE_CONFIG)) {
        expect(points.length).toBeGreaterThanOrEqual(2);

        // Curve must start at 0.0, 0.0
        expect(points[0].at).toBe(0.0);
        expect(points[0].cum).toBe(0.0);

        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];

          // Progression fraction must strictly increase
          expect(next.at).toBeGreaterThan(current.at);

          // Cumulative fraction must be monotonically non-decreasing
          expect(next.cum).toBeGreaterThanOrEqual(current.cum);
        }

        // Curve must end at 1.0, 1.0 at the end of the cycle
        const last = points[points.length - 1];
        expect(last.at).toBe(1.0);
        expect(last.cum).toBe(1.0);
      }
    });

    test('refPhasingFor produces monotonically non-decreasing cumulative spend ending at 1.0 at cycle end', () => {
      const cycleLength = 100;
      const allCategories = [...REF_VOLATILE_CATEGORIES, ...REF_STABLE_CATEGORIES];

      for (const cat of allCategories) {
        // Day 0 produces 0.0
        expect(refPhasingFor(cat, 0, cycleLength)).toBe(0.0);

        // Day of cycleLength produces exactly 1.0
        expect(refPhasingFor(cat, cycleLength, cycleLength)).toBe(1.0);

        // Past cycleLength clamps to 1.0
        expect(refPhasingFor(cat, cycleLength + 10, cycleLength)).toBe(1.0);

        // Across all days, progression must be monotonically non-decreasing
        let previous = 0.0;
        for (let day = 1; day <= cycleLength; day++) {
          const current = refPhasingFor(cat, day, cycleLength);
          expect(current).toBeGreaterThanOrEqual(previous);
          expect(current).toBeLessThanOrEqual(1.0);
          previous = current;
        }
      }
    });
  });

  // ── 7. Crop Recommendation Engine Properties ───────────────────────────────
  describe('Crop Recommendation Determinism & Stability', () => {
    const candidates = [
      { crop: 'Tomato', predictedCost: 180000 },
      { crop: 'Maize', predictedCost: 110000 },
      { crop: 'Paddy', predictedCost: 125000 },
      { crop: 'Chili', predictedCost: 160000 },
    ];
    const history = {
      Tomato: [0.08, 0.12, 0.10],
      Maize: [0.18, 0.22],
      Paddy: [0.05],
      Chili: [],
    };

    test('ranking is deterministic over repeated runs', () => {
      const first = computeCropRanking(candidates, history);
      for (let i = 0; i < 20; i++) {
        const next = computeCropRanking(candidates, history);
        expect(next).toEqual(first);
      }
    });

    test('candidate list order does not flip the final ranking', () => {
      const original = computeCropRanking(candidates, history);
      const permuted = computeCropRanking([...candidates].reverse(), history);
      expect(permuted).toEqual(original);
    });
  });
});
