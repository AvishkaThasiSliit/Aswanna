/**
 * alertService.js – compute variance and write Alert documents.
 *
 * Called by expenseService after every create / update / delete.
 * Also called by the variance endpoint.
 */

import mongoose from 'mongoose';
import { Alert } from '../models/Alert.js';
import { ThresholdConfig } from '../models/ThresholdConfig.js';
import { Expense } from '../models/Expense.js';
import { Cycle } from '../models/Cycle.js';
import { getBaselineMap } from './baselineService.js';
import { computeVariance, DEFAULT_THRESHOLDS } from '../../../shared/variance.js';

const CATEGORIES = ['seed','fertilizer','agrochemical','labour','machinery','fuel','irrigation','other'];

/**
 * Aggregate actual spend per category for a cycle.
 * @param {string|ObjectId} cycleId
 * @returns {Promise<{[category]: number}>}
 */
async function getActualMap(cycleId) {
  const oid = new mongoose.Types.ObjectId(cycleId.toString());

  const agg = await Expense.aggregate([
    { $match: { cycleId: oid, deletedAt: null } },
    { $project: {
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
      labourCost:   '$subtotals.labour',
      machineryCost:'$subtotals.machinery',
      otherCost:    '$other.amount',
    }},
    { $group: {
      _id: null,
      seed:         { $sum: '$seed' },
      fertilizer:   { $sum: '$fertilizer' },
      agrochemical: { $sum: '$agrochemical' },
      fuel:         { $sum: '$fuel' },
      irrigation:   { $sum: '$irrigation' },
      labour:       { $sum: { $ifNull: ['$labourCost',   0] } },
      machinery:    { $sum: { $ifNull: ['$machineryCost', 0] } },
      other:        { $sum: { $ifNull: ['$otherCost',    0] } },
    }},
  ]);

  if (!agg.length) return Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const row = agg[0];
  return Object.fromEntries(CATEGORIES.map(c => [c, row[c] || 0]));
}

/**
 * Build a threshold object that matches DEFAULT_THRESHOLDS shape from a DB doc.
 */
function buildThresholds(doc) {
  if (!doc) return DEFAULT_THRESHOLDS;
  return {
    ...DEFAULT_THRESHOLDS,
    mode: doc.mode || 'tiered',
    single: doc.single ?? DEFAULT_THRESHOLDS.single,
    stable:   { ...DEFAULT_THRESHOLDS.stable,   attention: doc.stable?.attention,   significant: doc.stable?.significant },
    volatile: { ...DEFAULT_THRESHOLDS.volatile, attention: doc.volatile?.attention, significant: doc.volatile?.significant },
  };
}

/**
 * Compute cycle day from startDate.
 */
function dayOfCycle(startDate) {
  if (!startDate) return 1;
  const ms = Date.now() - new Date(startDate).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

/**
 * Compute cycle length in days (startDate → endDate or fallback 120 days).
 */
function cycleLength(startDate, endDate) {
  if (!startDate) return 120;
  const end = endDate ? new Date(endDate) : new Date(new Date(startDate).getTime() + 120 * 86400000);
  return Math.max(1, Math.ceil((end - new Date(startDate)) / 86400000));
}

/**
 * Recompute variance for a cycle and upsert Alert documents.
 *
 * @param {string} cycleId
 * @returns {Promise<object>} – variance result from computeVariance
 */
export async function recomputeAlerts(cycleId) {
  const cycle = await Cycle.findById(cycleId).lean();
  if (!cycle) return null;

  const [baselines, actuals, thresholdDoc, existingAlerts] = await Promise.all([
    getBaselineMap(cycleId),
    getActualMap(cycleId),
    ThresholdConfig.findOne({ cycleId }).lean(),
    Alert.find({ cycleId }).lean()
  ]);

  if (!Object.keys(baselines).length) return null; // no baseline yet

  const alertMap = {};
  for (const a of existingAlerts) {
    alertMap[a.category] = a;
  }

  const thresholds = buildThresholds(thresholdDoc);
  const day = dayOfCycle(cycle.startDate);
  const length = cycleLength(cycle.startDate, cycle.endDate);

  const variance = computeVariance({
    baselines,
    actuals,
    dayOfCycle: day,
    cycleLength: length,
    thresholds,
  });

  const alertOps = [];
  for (const [cat, data] of Object.entries(variance.categories)) {
    if (data.tier !== 'normal') {
      const existing = alertMap[cat];
      let shouldUnresolve = false;
      if (!existing) {
        shouldUnresolve = true;
      } else if (existing.tier === 'normal') {
        shouldUnresolve = true;
      } else if (existing.tier === 'attention' && data.tier === 'significant') {
        shouldUnresolve = true;
      } else if (existing.resolvedAt && data.variancePct > (existing.variancePct || 0)) {
        shouldUnresolve = true;
      }

      const setUpdate = {
        tier:           data.tier,
        variancePct:    data.variancePct,
        expectedToDate: data.expectedToDate,
        actualToDate:   data.actual,
        dayOfCycle:     day,
        reason:         data.reason || null,
      };

      if (shouldUnresolve) {
        setUpdate.resolvedAt = null;
      }

      const updatePayload = {
        $set: setUpdate,
      };
      
      if (!shouldUnresolve) {
        updatePayload.$setOnInsert = { resolvedAt: null };
      }

      alertOps.push({
        updateOne: {
          filter: { cycleId: cycle._id, category: cat },
          update: updatePayload,
          upsert: true,
        },
      });
    } else {
      // If tier returns to normal, mark any existing unresolved alert as resolved
      alertOps.push({
        updateOne: {
          filter: { cycleId: cycle._id, category: cat, resolvedAt: null },
          update: {
            $set: {
              tier: 'normal',
              variancePct: data.variancePct,
              resolvedAt: new Date(),
            },
          },
        },
      });
    }
  }

  if (alertOps.length) await Alert.bulkWrite(alertOps);

  return variance;
}

/**
 * Compute variance without writing to DB (for the GET endpoint).
 * @param {string} cycleId
 * @returns {Promise<object|null>}
 */
export async function computeVarianceForCycle(cycleId) {
  const cycle = await Cycle.findById(cycleId).lean();
  if (!cycle) return null;

  const [baselines, actuals, thresholdDoc] = await Promise.all([
    getBaselineMap(cycleId),
    getActualMap(cycleId),
    ThresholdConfig.findOne({ cycleId }).lean(),
  ]);

  if (!Object.keys(baselines).length) return null;

  const thresholds = buildThresholds(thresholdDoc);
  const day = dayOfCycle(cycle.startDate);
  const length = cycleLength(cycle.startDate, cycle.endDate);

  return computeVariance({ baselines, actuals, dayOfCycle: day, cycleLength: length, thresholds });
}
