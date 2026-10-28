// FROZEN: end-of-season cost forecasting overlaps SO1 (cost prediction). Not part of the SO3 deliverable. Disabled by default.
/**
 * server/src/services/forecastService.js
 *
 * SO3 End-of-Season Cost Forecasting Service.
 * Evaluates knowledge-anchored ratio estimator with conformal prediction intervals.
 * Fully self-contained pure JavaScript (no Python runtime dependency).
 * Advisory only: does NOT modify or write Alert documents.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Cycle } from '../models/Cycle.js';
import { Baseline } from '../models/Baseline.js';
import { Expense } from '../models/Expense.js';
import { ENV } from '../config/env.js';
import { SO1_CROP_ALIASES } from '../../../shared/config/so1Mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORIES = ['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other'];
const KNOTS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const EVAL_TAUS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export function normalizeCropName(crop) {
  if (!crop) return crop;
  return SO1_CROP_ALIASES[crop] || SO1_CROP_ALIASES[crop.trim()] || crop;
}

// Load static configs from shared/config
const sharedConfigDir = path.resolve(__dirname, '../../../shared/config');
const phasingPriorsPath = path.join(sharedConfigDir, 'phasingPriors.json');
const conformalQuantilesPath = path.join(sharedConfigDir, 'conformalQuantiles.json');
const learnedPhasingPath = path.join(sharedConfigDir, 'learnedPhasing.json');

let phasingPriorsData = null;
let conformalQuantilesData = null;

function loadPhasingPriors() {
  if (!phasingPriorsData && fs.existsSync(phasingPriorsPath)) {
    phasingPriorsData = JSON.parse(fs.readFileSync(phasingPriorsPath, 'utf8'));
  }
  return phasingPriorsData;
}

function loadConformalQuantiles() {
  if (!conformalQuantilesData && fs.existsSync(conformalQuantilesPath)) {
    conformalQuantilesData = JSON.parse(fs.readFileSync(conformalQuantilesPath, 'utf8'));
  }
  return conformalQuantilesData;
}

export function loadLearnedPhasing() {
  if (fs.existsSync(learnedPhasingPath)) {
    try {
      return JSON.parse(fs.readFileSync(learnedPhasingPath, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Piecewise-linear 1D interpolation of curve at progress t in [0, 1].
 */
export function interpolateCurve(knots, values, t) {
  if (t <= knots[0]) return values[0];
  if (t >= knots[knots.length - 1]) return values[values.length - 1];
  for (let i = 0; i < knots.length - 1; i++) {
    if (t >= knots[i] && t <= knots[i + 1]) {
      const frac = (t - knots[i]) / (knots[i + 1] - knots[i]);
      return values[i] + frac * (values[i + 1] - values[i]);
    }
  }
  return values[values.length - 1];
}

/**
 * Finds the closest evaluated tau knot string key.
 */
export function findNearestTauKey(tau) {
  let closest = EVAL_TAUS[0];
  let minDiff = Math.abs(tau - closest);
  for (const t of EVAL_TAUS) {
    const diff = Math.abs(tau - t);
    if (diff < minDiff) {
      minDiff = diff;
      closest = t;
    }
  }
  return closest.toFixed(2);
}

/**
 * Evaluates expected cumulative spend fraction across categories.
 */
export function computeExpectedFraction(tau, categoryShares, curves) {
  let frac = 0.0;
  for (const cat of CATEGORIES) {
    const share = categoryShares[cat] ?? 0.125;
    const catCurve = curves[cat] ?? KNOTS;
    const val = interpolateCurve(KNOTS, catCurve, tau);
    frac += share * val;
  }
  return Math.max(0.001, Math.min(1.0, frac));
}

/**
 * Derives minimum progress gate tau based on sample size n and mode.
 * Evaluated across 30 seeds under S1 & S2:
 * Prior mode (or n < 10): minTau = 0.30
 * Learned mode (n >= 10): minTau = 0.20
 */
export function getMinTauForN(n, mode = 'learned') {
  if (mode === 'prior' || !n || n < 5) return 0.30;
  if (n < 10) return 0.30;
  return 0.20;
}

/**
 * Pure calculation helper for forecast metrics given explicit inputs.
 */
export function computeForecastFromValues({
  crop,
  tau,
  spendToDate,
  categoryBaselines,
  mode = 'prior',
  nCycles = null,
  learnedPhasingConfig = null,
  priorsConfig = null,
  conformalConfig = null,
}) {
  const priors = priorsConfig || loadPhasingPriors();
  const conformal = conformalConfig || loadConformalQuantiles();
  const learned = learnedPhasingConfig || loadLearnedPhasing();

  const notes = [
    'Advisory projection only; not a financial guarantee.',
    'Prediction interval calibrated at 80% coverage using simulation-derived conformal quantiles; field calibration pending.'
  ];

  // Resolve method and curves based on deployment rules
  let method = 'prior';
  let curves = null;
  let minTau = 0.30;

  const resolvedCrop = normalizeCropName(crop);
  const cropPriors = priors?.crops?.[resolvedCrop]?.categories;

  if (mode === 'learned') {
    const learnedCrop = learned?.crops?.[resolvedCrop];
    const availableCycles = (nCycles !== null && nCycles !== undefined) ? nCycles : (learnedCrop?.n_cycles || 0);
    if (learnedCrop && availableCycles >= 5 && learnedCrop.categories) {
      method = 'learned';
      minTau = getMinTauForN(availableCycles, 'learned');
      curves = {};
      for (const cat of CATEGORIES) {
        curves[cat] = learnedCrop.categories[cat] || (cropPriors ? cropPriors[cat]?.p50 : KNOTS);
      }
    } else {
      method = 'prior';
      minTau = 0.30;
      const count = availableCycles;
      notes.push(`Insufficient historical closed cycles for ${resolvedCrop} (n=${count} < 5); fell back to survey prior.`);
    }
  }

  if (method === 'prior') {
    if (!cropPriors) {
      return {
        status: 'insufficient_data',
        message: `Crop "${crop}" is not supported by the phasing prior model.`,
        notes,
      };
    }
    curves = {};
    for (const cat of CATEGORIES) {
      curves[cat] = cropPriors[cat]?.p50 || KNOTS;
    }
  }

  // Calculate baseline total and category shares
  let baselineTotal = 0;
  for (const cat of CATEGORIES) {
    baselineTotal += (categoryBaselines[cat] || 0);
  }

  if (baselineTotal <= 0) {
    return {
      status: 'insufficient_data',
      message: 'Baseline cost total is zero or missing.',
      notes,
    };
  }

  const categoryShares = {};
  for (const cat of CATEGORIES) {
    categoryShares[cat] = (categoryBaselines[cat] || 0) / baselineTotal;
  }

  // Progress check: minimum tau rule
  if (tau < minTau) {
    return {
      status: 'too_early',
      method,
      tau: Math.round(tau * 1000) / 1000,
      minTau,
      spendToDate: Math.round(spendToDate),
      baselineTotal: Math.round(baselineTotal),
      message: `Cycle is too early for reliable end-of-season forecasting (minimum progress: ${Math.round(minTau * 100)}%).`,
      notes: [
        `Current progress is ${Math.round(tau * 100)}%. Predictions unlock at ${Math.round(minTau * 100)}% progress.`,
        ...notes
      ],
    };
  }

  // Ratio estimator point forecast
  const expectedFrac = computeExpectedFraction(tau, categoryShares, curves);
  let pointForecast = expectedFrac > 0.02 ? (spendToDate / expectedFrac) : baselineTotal;
  pointForecast = Math.max(spendToDate, pointForecast);

  // Conformal prediction interval
  const tauKey = findNearestTauKey(tau);
  const quantilesTable = conformal?.quantiles?.[method] || conformal?.quantiles?.prior || {};
  const q = quantilesTable[tauKey] ?? 0.15;

  const lowBound = Math.max(Math.round(spendToDate), Math.round(pointForecast * (1.0 - q)));
  const highBound = Math.max(lowBound, Math.round(pointForecast * (1.0 + q)));

  const forecastFinal = Math.round(pointForecast);
  const roundedBaselineTotal = Math.round(baselineTotal);
  const projectedOverspendPct = roundedBaselineTotal > 0
    ? Math.round(((forecastFinal - roundedBaselineTotal) / roundedBaselineTotal) * 1000) / 10
    : 0;

  return {
    status: 'ready',
    method,
    tau: Math.round(tau * 1000) / 1000,
    spendToDate: Math.round(spendToDate),
    forecastFinal,
    interval: {
      low: lowBound,
      high: highBound,
      level: 0.8,
    },
    baselineTotal: roundedBaselineTotal,
    projectedOverspendPct,
    notes,
  };
}

/**
 * Aggregate actual spend per category for a cycle.
 */
async function getActualSpendMap(cycleId) {
  const oid = new mongoose.Types.ObjectId(cycleId.toString());
  const agg = await Expense.aggregate([
    { $match: { cycleId: oid, deletedAt: null } },
    {
      $project: {
        seed: {
          $reduce: {
            input: { $filter: { input: { $ifNull: ['$inputs', []] }, as: 'i', cond: { $eq: ['$$i.categoryTag', 'seed'] } } },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
          }
        },
        fertilizer: {
          $reduce: {
            input: { $filter: { input: { $ifNull: ['$inputs', []] }, as: 'i', cond: { $eq: ['$$i.categoryTag', 'fertilizer'] } } },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
          }
        },
        agrochemical: {
          $reduce: {
            input: { $filter: { input: { $ifNull: ['$inputs', []] }, as: 'i', cond: { $eq: ['$$i.categoryTag', 'agrochemical'] } } },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
          }
        },
        fuel: {
          $reduce: {
            input: { $filter: { input: { $ifNull: ['$inputs', []] }, as: 'i', cond: { $eq: ['$$i.categoryTag', 'fuel'] } } },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
          }
        },
        irrigation: {
          $reduce: {
            input: { $filter: { input: { $ifNull: ['$inputs', []] }, as: 'i', cond: { $eq: ['$$i.categoryTag', 'irrigation'] } } },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
          }
        },
        labourCost: '$subtotals.labour',
        machineryCost: '$subtotals.machinery',
        otherCost: '$other.amount',
      }
    },
    {
      $group: {
        _id: null,
        seed: { $sum: '$seed' },
        fertilizer: { $sum: '$fertilizer' },
        agrochemical: { $sum: '$agrochemical' },
        fuel: { $sum: '$fuel' },
        irrigation: { $sum: '$irrigation' },
        labour: { $sum: { $ifNull: ['$labourCost', 0] } },
        machinery: { $sum: { $ifNull: ['$machineryCost', 0] } },
        other: { $sum: { $ifNull: ['$otherCost', 0] } },
      }
    },
  ]);

  if (!agg.length) return Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const row = agg[0];
  return Object.fromEntries(CATEGORIES.map(c => [c, row[c] || 0]));
}

function calculateTau(startDate, endDate) {
  if (!startDate) return 0.5;
  const now = Date.now();
  const startMs = new Date(startDate).getTime();
  const endMs = endDate ? new Date(endDate).getTime() : startMs + 120 * 86400000;
  const cycleDuration = Math.max(1, (endMs - startMs) / 86400000);
  const elapsedDays = Math.max(1, (now - startMs) / 86400000);
  return Math.min(1.0, Math.max(0.01, elapsedDays / cycleDuration));
}

/**
 * Main service entrypoint for a cycle ID.
 */
export async function computeForecastForCycle(cycleId, overrideMode = null) {
  const mode = overrideMode || process.env.FORECAST_MODE || ENV.FORECAST_MODE || 'off';
  if (mode === 'off') {
    return null;
  }

  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) return null;

  const baselineDocs = await Baseline.find({ cycleId: cycle._id }).lean();
  if (!baselineDocs || baselineDocs.length === 0 || cycle.baselineStatus !== 'ready') {
    return {
      status: 'insufficient_data',
      message: 'Baseline data not ready or missing for this cycle',
      notes: ['Baseline must be established before end-of-season forecasting can run.'],
    };
  }

  const categoryBaselines = {};
  let isEstimatedSplit = false;
  let isDerived = false;
  let isLowConfidence = false;
  let districtPolicy = 'exact';

  for (const doc of baselineDocs) {
    categoryBaselines[doc.category] = doc.expected || 0;
    if (doc.is_estimated_split) isEstimatedSplit = true;
    if (doc.derived) isDerived = true;
    if (doc.low_confidence) isLowConfidence = true;
    if (doc.district_policy_used) districtPolicy = doc.district_policy_used;
  }

  const actualSpendMap = await getActualSpendMap(cycle._id);
  const spendToDate = Object.values(actualSpendMap).reduce((a, b) => a + b, 0);

  const tau = cycle.status === 'closed' ? 1.0 : calculateTau(cycle.startDate, cycle.endDate);

  const resolvedCrop = normalizeCropName(cycle.crop);
  const closedCyclesCount = await Cycle.countDocuments({
    crop: { $in: [cycle.crop, resolvedCrop] },
    status: 'closed',
    deletedAt: null,
  });

  const result = computeForecastFromValues({
    crop: cycle.crop,
    tau,
    spendToDate,
    categoryBaselines,
    mode,
    nCycles: closedCyclesCount > 0 ? closedCyclesCount : null,
  });

  const dataQuality = {
    isEstimatedSplit,
    isDerived,
    isLowConfidence,
    districtPolicy,
  };

  if (isEstimatedSplit) {
    result.notes?.push('Baseline category allocations use estimated regional splits.');
  }
  if (isLowConfidence) {
    result.notes?.push('Baseline carries low confidence indicator from model.');
  }

  return {
    ...result,
    dataQuality,
  };
}
