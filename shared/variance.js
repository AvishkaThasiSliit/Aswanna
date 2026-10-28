/**
 * variance.js – pure variance engine (no DB access).
 *
 * Exported functions are used by both the server service and client UI.
 *
 * Threshold table (Table 3 from the proposal):
 *   stable   categories (labour, machinery, irrigation, other):
 *     Normal: variancePct within ±10%
 *     Attention: 10% < variancePct ≤ 15%   (overspend only)
 *     Significant: variancePct > 15%
 *
 *   volatile categories (seed, fertilizer, agrochemical, fuel):
 *     Normal: variancePct within ±7%
 *     Attention: 7% < variancePct ≤ 12%    (overspend only)
 *     Significant: variancePct > 12%
 *
 * agrochemical → volatile,  other → stable   (CONFIRM WITH DoA)
 */

import { phasingFor } from './phasing.js';

// ── Threshold config (mirrors ThresholdConfig in DB) ─────────────────────────
export const DEFAULT_THRESHOLDS = {
  mode: 'tiered',
  single: 0.10,
  stable: {
    categories: ['labour', 'machinery', 'irrigation', 'other'],
    attention:    0.10,   // Normal <= 10%, Attention > 10% to <= 15%
    significant:  0.15,   // Significant > 15%
  },
  volatile: {
    categories: ['seed', 'fertilizer', 'agrochemical', 'fuel'],
    attention:   0.07,   // Normal <= 7%, Attention > 7% to <= 12%
    significant: 0.12,   // Significant > 12%
  },
};

/**
 * Classify a category as 'stable' or 'volatile'.
 * @param {string} category
 * @param {object} [thresholds] – optional override (must match DEFAULT_THRESHOLDS shape)
 * @returns {'stable'|'volatile'}
 */
export function categoryVolatility(category, thresholds = DEFAULT_THRESHOLDS) {
  const stable = thresholds.stable?.categories || DEFAULT_THRESHOLDS.stable.categories;
  const volatile = thresholds.volatile?.categories || DEFAULT_THRESHOLDS.volatile.categories;
  if (stable.includes(category)) return 'stable';
  if (volatile.includes(category)) return 'volatile';
  return 'stable'; // fallback
}

/**
 * Determine the tier string from a variancePct and category.
 * Only overspend (positive variance) generates Attention/Significant.
 *
 * @param {number}  variancePct  – signed fraction
 * @param {string}  category
 * @param {object}  [thresholds]
 * @returns {'normal'|'attention'|'significant'}
 */
export function computeTier(variancePct, category, thresholds = DEFAULT_THRESHOLDS) {
  if (!isFinite(variancePct) || variancePct <= 0) return 'normal'; // Only overspend alerts

  const mode = thresholds?.mode || 'tiered';

  if (mode === 'single') {
    const singleThresh = thresholds?.single ?? 0.10;
    return variancePct > singleThresh ? 'significant' : 'normal';
  }

  // tiered mode based on proposal Table 3
  const vol = categoryVolatility(category, thresholds);
  const cfg = vol === 'volatile' ? thresholds.volatile : thresholds.stable;

  const attentionThresh = cfg?.attention ?? (vol === 'volatile' ? 0.07 : 0.10);
  const significantThresh = cfg?.significant ?? (vol === 'volatile' ? 0.12 : 0.15);

  if (variancePct > significantThresh) return 'significant';
  if (variancePct > attentionThresh)   return 'attention';
  return 'normal';
}

/**
 * Compute per-category and total variance metrics.
 */
export function computeVariance({ baselines, actuals, dayOfCycle, cycleLength, thresholds = DEFAULT_THRESHOLDS }) {
  const categories = {};
  let totalExpected = 0;
  let totalActual = 0;
  let totalExpectedToDate = 0;

  for (const [cat, bl] of Object.entries(baselines)) {
    const expected = bl.expected || 0;
    const low      = bl.low      || 0;
    const high     = bl.high     || 0;
    const actual   = actuals[cat] || 0;

    // Guard: day 0 and zero/negative cycle length
    const phase = bl.phase !== undefined
      ? bl.phase
      : ((cycleLength > 0 && dayOfCycle > 0)
        ? phasingFor(cat, dayOfCycle, cycleLength)
        : 0);

    const expectedToDate = bl.expectedToDate !== undefined
      ? bl.expectedToDate
      : expected * phase;

    // Guard zero expectedToDate: spend above zero expectedToDate returns flagged state (attention tier, no_baseline reason)
    let variancePct = 0;
    let tier = 'normal';
    let reason = null;

    if (dayOfCycle <= 0 || cycleLength <= 0) {
      // Day 0 or invalid cycle length guard
      variancePct = 0;
      tier = 'normal';
      reason = null;
    } else if (expectedToDate > 0) {
      variancePct = (actual - expectedToDate) / expectedToDate;
      tier = computeTier(variancePct, cat, thresholds);
    } else if (actual > 0) {
      variancePct = 0;
      tier = 'attention';
      reason = 'no_baseline';
    }

    // Guard divide-by-zero for budgetUsedPct = actual / expected
    const budgetUsedPct = expected > 0
      ? actual / expected
      : (actual > 0 ? Infinity : 0);

    categories[cat] = {
      expected,
      low,
      high,
      actual,
      expectedToDate,
      variancePct,
      budgetUsedPct,
      tier,
      reason,
    };

    totalExpected       += expected;
    totalActual         += actual;
    totalExpectedToDate += expectedToDate;
  }

  const totalVariancePct = totalExpectedToDate > 0
    ? (totalActual - totalExpectedToDate) / totalExpectedToDate
    : 0;

  const totalBudgetUsedPct = totalExpected > 0
    ? totalActual / totalExpected
    : 0;

  return {
    categories,
    total: {
      expected: totalExpected,
      actual:   totalActual,
      expectedToDate: totalExpectedToDate,
      variancePct: totalVariancePct,
      budgetUsedPct: totalBudgetUsedPct,
    },
  };
}
