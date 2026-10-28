/**
 * referenceEngine.js
 *
 * INDEPENDENT REFERENCE IMPLEMENTATION FOR EVALUATION HARNESS (SO3.6).
 *
 * Written separately from shared/variance.js to provide an independent,
 * verifiable ground-truth comparison for variance calculation and tier determination.
 *
 * Threshold Specification (Proposal Table 3):
 *   - Volatile categories (seed, fertilizer, agrochemical, fuel):
 *       Normal: variancePct <= +7%
 *       Attention: +7% < variancePct <= +12%
 *       Significant: variancePct > +12%
 *   - Stable categories (labour, machinery, irrigation, other):
 *       Normal: variancePct <= +10%
 *       Attention: +10% < variancePct <= +15%
 *       Significant: variancePct > +15%
 *   - Single Threshold Baseline (Proposal Section 3.3):
 *       Flat +10% threshold across all categories.
 *       Normal: variancePct <= +10%
 *       Significant: variancePct > +10% (no attention tier)
 *   - Underspend:
 *       Negative variance <= 0 is always normal.
 *   - Zero-Baseline Category:
 *       expectedToDate === 0 and actual > 0 -> tier 'attention', reason 'no_baseline'.
 */

export const REF_VOLATILE_CATEGORIES = ['seed', 'fertilizer', 'agrochemical', 'fuel'];
export const REF_STABLE_CATEGORIES = ['labour', 'machinery', 'irrigation', 'other'];

export const REF_CURVE_CONFIG = {
  front_loaded: [
    { at: 0.0, cum: 0.0 },
    { at: 0.15, cum: 0.70 },
    { at: 0.40, cum: 0.90 },
    { at: 1.0, cum: 1.0 },
  ],
  linear: [
    { at: 0.0, cum: 0.0 },
    { at: 1.0, cum: 1.0 },
  ],
};

export const REF_CATEGORY_CURVES = {
  seed: 'front_loaded',
  fertilizer: 'front_loaded',
  agrochemical: 'front_loaded',
  labour: 'linear',
  machinery: 'linear',
  fuel: 'linear',
  irrigation: 'linear',
  other: 'linear',
};

/**
 * Independent piecewise linear interpolation function.
 */
function interpolatePoints(points, t) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (t >= p1.at && t <= p2.at) {
      if (p2.at === p1.at) return p1.cum;
      const progress = (t - p1.at) / (p2.at - p1.at);
      return p1.cum + progress * (p2.cum - p1.cum);
    }
  }
  return 1.0;
}

/**
 * Independent phasing fraction calculation.
 */
export function refPhasingFor(category, dayOfCycle, cycleLength) {
  if (!dayOfCycle || dayOfCycle <= 0 || !cycleLength || cycleLength <= 0) {
    return 0.0;
  }
  if (dayOfCycle >= cycleLength) {
    return 1.0;
  }
  const curveType = REF_CATEGORY_CURVES[category] || 'linear';
  const breakpoints = REF_CURVE_CONFIG[curveType] || REF_CURVE_CONFIG.linear;
  const t = dayOfCycle / cycleLength;
  const cumFraction = interpolatePoints(breakpoints, t);
  return Math.max(0.0, Math.min(1.0, cumFraction));
}

/**
 * Independent volatility categorization.
 */
export function refCategoryVolatility(category) {
  return REF_VOLATILE_CATEGORIES.includes(category) ? 'volatile' : 'stable';
}

/**
 * Independent tier assignment.
 *
 * @param {number} variancePct - Fraction (e.g. 0.08 for +8%)
 * @param {string} category
 * @param {'tiered'|'single'|'baseline'|'flat_10'} mode
 * @returns {'normal'|'attention'|'significant'}
 */
export function refComputeTier(variancePct, category, mode = 'tiered') {
  if (!Number.isFinite(variancePct) || variancePct <= 0) {
    return 'normal';
  }

  // Proposal Section 3.3 baseline rule: binary alert when variance > 0 (actual > expectedToDate), no tiers.
  if (mode === 'single' || mode === 'baseline') {
    return variancePct > 0 ? 'significant' : 'normal';
  }

  // Extra baseline variant: flat 10% threshold rule.
  if (mode === 'flat_10') {
    return variancePct > 0.10 ? 'significant' : 'normal';
  }

  const isVolatile = refCategoryVolatility(category) === 'volatile';
  const attentionThreshold = isVolatile ? 0.07 : 0.10;
  const significantThreshold = isVolatile ? 0.12 : 0.15;

  if (variancePct > significantThreshold) {
    return 'significant';
  }
  if (variancePct > attentionThreshold) {
    return 'attention';
  }
  return 'normal';
}

/**
 * Independent variance calculation.
 *
 * @param {object} params
 * @param {object} params.baselines - { [cat]: { expected, low, high } }
 * @param {object} params.actuals - { [cat]: number }
 * @param {number} params.dayOfCycle
 * @param {number} params.cycleLength
 * @param {'tiered'|'single'} [params.mode='tiered']
 * @returns {object} Reference variance results
 */
export function refComputeVariance({
  baselines,
  actuals = {},
  dayOfCycle,
  cycleLength,
  mode = 'tiered',
}) {
  const categories = {};
  let totalExpected = 0;
  let totalActual = 0;
  let totalExpectedToDate = 0;

  for (const [cat, bl] of Object.entries(baselines)) {
    const expected = Number(bl?.expected || 0);
    const low = Number(bl?.low || 0);
    const high = Number(bl?.high || 0);
    const actual = Number(actuals[cat] || 0);

    const phase = bl?.phase !== undefined
      ? bl.phase
      : (cycleLength > 0 && dayOfCycle > 0 ? refPhasingFor(cat, dayOfCycle, cycleLength) : 0);

    const expectedToDate = bl?.expectedToDate !== undefined
      ? bl.expectedToDate
      : expected * phase;

    let variancePct = 0;
    let tier = 'normal';
    let reason = null;

    if (dayOfCycle <= 0 || cycleLength <= 0) {
      variancePct = 0;
      tier = 'normal';
      reason = null;
    } else if (expectedToDate > 0) {
      variancePct = (actual - expectedToDate) / expectedToDate;
      tier = refComputeTier(variancePct, cat, mode);
    } else if (actual > 0) {
      variancePct = 0;
      tier = 'attention';
      reason = 'no_baseline';
    }

    const budgetUsedPct = expected > 0 ? actual / expected : (actual > 0 ? Infinity : 0);

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

    totalExpected += expected;
    totalActual += actual;
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
      actual: totalActual,
      expectedToDate: totalExpectedToDate,
      variancePct: totalVariancePct,
      budgetUsedPct: totalBudgetUsedPct,
    },
  };
}

/**
 * Compare production engine result with reference engine result.
 * Checks for exact agreement within floating-point tolerance (1e-6).
 *
 * @param {object} engineResult
 * @param {object} refResult
 * @returns {{ agreement: boolean, diffs: Array<string> }}
 */
export function compareEngineWithReference(engineResult, refResult) {
  const diffs = [];
  const epsilon = 1e-6;

  // Compare categories
  const allCats = new Set([
    ...Object.keys(engineResult.categories || {}),
    ...Object.keys(refResult.categories || {}),
  ]);

  for (const cat of allCats) {
    const eCat = engineResult.categories[cat];
    const rCat = refResult.categories[cat];

    if (!eCat || !rCat) {
      diffs.push(`Category ${cat} missing in one result`);
      continue;
    }

    if (Math.abs(eCat.expectedToDate - rCat.expectedToDate) > epsilon) {
      diffs.push(
        `Category ${cat} expectedToDate mismatch: engine=${eCat.expectedToDate}, ref=${rCat.expectedToDate}`
      );
    }

    if (Math.abs(eCat.variancePct - rCat.variancePct) > epsilon) {
      diffs.push(
        `Category ${cat} variancePct mismatch: engine=${eCat.variancePct}, ref=${rCat.variancePct}`
      );
    }

    if (eCat.tier !== rCat.tier) {
      diffs.push(`Category ${cat} tier mismatch: engine=${eCat.tier}, ref=${rCat.tier}`);
    }

    if (eCat.reason !== rCat.reason) {
      diffs.push(`Category ${cat} reason mismatch: engine=${eCat.reason}, ref=${rCat.reason}`);
    }
  }

  // Compare totals
  if (Math.abs(engineResult.total.expectedToDate - refResult.total.expectedToDate) > epsilon) {
    diffs.push(
      `Total expectedToDate mismatch: engine=${engineResult.total.expectedToDate}, ref=${refResult.total.expectedToDate}`
    );
  }

  if (Math.abs(engineResult.total.variancePct - refResult.total.variancePct) > epsilon) {
    diffs.push(
      `Total variancePct mismatch: engine=${engineResult.total.variancePct}, ref=${refResult.total.variancePct}`
    );
  }

  return {
    agreement: diffs.length === 0,
    diffs,
  };
}
