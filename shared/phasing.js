/**
 * phasingFor – cumulative expected-spend fraction by day of cycle.
 *
 * CONFIRM WITH DoA: these curves are placeholders.
 * Replace the CURVE_CONFIG values with DoA-agreed profiles before going live.
 *
 * Categories:
 *   linear (labour, machinery, fuel, irrigation) – spend evenly each day.
 *   front-loaded (seed, fertilizer, agrochemical) – heavier in first third.
 *
 * Returns a number in [0, 1] representing the fraction of the expected total
 * that should have been spent by `dayOfCycle` (1-indexed).
 * Day 0 returns 0. Day >= cycleLength returns 1.
 */

// ── CONFIRM WITH DoA ─────────────────────────────────────────────────────────
// Configurable curve breakpoints.  Each entry is { atFraction, cumFraction }:
//   atFraction  – fraction of total cycle length (0..1)
//   cumFraction – expected cumulative spend fraction at that point
// The engine interpolates linearly between breakpoints.
const CURVE_CONFIG = {
  /** Spend is roughly uniform – seed money goes out in first 15% of cycle */
  front_loaded: [
    { at: 0,    cum: 0 },
    { at: 0.15, cum: 0.70 },
    { at: 0.40, cum: 0.90 },
    { at: 1.00, cum: 1.00 },
  ],

  /** Spend is uniform across the cycle */
  linear: [
    { at: 0,    cum: 0 },
    { at: 1.00, cum: 1.00 },
  ],
};

// Category → curve mapping.  CONFIRM WITH DoA.
const CATEGORY_CURVE = {
  seed:         'front_loaded',
  fertilizer:   'front_loaded',
  agrochemical: 'front_loaded',  // CONFIRM WITH DoA
  labour:       'linear',
  machinery:    'linear',
  fuel:         'linear',
  irrigation:   'linear',
  other:        'linear',        // CONFIRM WITH DoA
};

/**
 * Interpolate between breakpoints.
 * @param {Array<{at:number,cum:number}>} breakpoints
 * @param {number} t – value in [0,1]
 * @returns {number}
 */
function interpolate(breakpoints, t) {
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i];
    const b = breakpoints[i + 1];
    if (t >= a.at && t <= b.at) {
      if (b.at === a.at) return a.cum;
      const ratio = (t - a.at) / (b.at - a.at);
      return a.cum + ratio * (b.cum - a.cum);
    }
  }
  return 1; // past last breakpoint
}

/**
 * @param {string} category – one of CATEGORY_TAGS
 * @param {number} dayOfCycle – 1-based day within the cycle (0 → 0)
 * @param {number} cycleLength – total length of the cycle in days (>= 1)
 * @returns {number} – phase fraction in [0, 1]
 */
export function phasingFor(category, dayOfCycle, cycleLength) {
  if (!dayOfCycle || dayOfCycle <= 0 || !cycleLength || cycleLength <= 0) return 0;
  if (dayOfCycle >= cycleLength) return 1;

  const curveName = CATEGORY_CURVE[category] || 'linear';
  const breakpoints = CURVE_CONFIG[curveName];
  const t = dayOfCycle / cycleLength;
  const result = interpolate(breakpoints, t);
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, result));
}

export { CATEGORY_CURVE, CURVE_CONFIG };
