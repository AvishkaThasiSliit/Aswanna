/**
 * Variance endpoint – read-only, no auth side-effects.
 * GET /api/cycles/:id/variance
 *
 * Returns the computed variance for every category plus total,
 * enriched with SO1 metadata and category split derivations.
 */

import { Router } from 'express';
import { Cycle } from '../models/Cycle.js';
import { Baseline } from '../models/Baseline.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership } from '../middleware/ownership.js';
import { computeVarianceForCycle } from '../services/alertService.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET /api/cycles/:id/variance
router.get('/', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const baselineDocs = await Baseline.find({ cycleId: cycle._id }).lean();
  const variance = await computeVarianceForCycle(req.params.id);
  if (!variance || cycle.baselineStatus === 'missing' || !baselineDocs || baselineDocs.length === 0) {
    return res.json({
      status: 'missing_baseline',
      baselineStatus: 'missing',
      baselines: null,
      total: null,
      categories: null,
      message: 'No baseline yet for this cycle',
    });
  }

  // Load baseline docs to extract category flags and total prediction bounds
  const baselineMetaMap = {};
  let totalPredictedCost = null;
  let intervalLow = null;
  let intervalHigh = null;

  for (const doc of baselineDocs) {
    baselineMetaMap[doc.category] = {
      is_estimated_split: Boolean(doc.is_estimated_split),
      derived: Boolean(doc.derived),
      low_confidence: Boolean(doc.low_confidence),
      district_policy_used: doc.district_policy_used,
    };
    if (doc.totalPredictedCost) totalPredictedCost = doc.totalPredictedCost;
    if (doc.intervalLow) intervalLow = doc.intervalLow;
    if (doc.intervalHigh) intervalHigh = doc.intervalHigh;
  }

  // Enrich categories with estimated split flags
  const enrichedCategories = {};
  if (variance.categories) {
    for (const [cat, data] of Object.entries(variance.categories)) {
      const meta = baselineMetaMap[cat] || {};
      enrichedCategories[cat] = {
        ...data,
        is_estimated_split: meta.is_estimated_split || false,
        derived: meta.derived || false,
        // Check if actual spend is within category prediction interval
        withinPredictionInterval: data.actual >= data.low && data.actual <= data.high,
      };
    }
  }

  // Check if total spend is within overall prediction interval
  const totalActual = variance.total?.actual || 0;
  const totalLow = intervalLow ?? (variance.total?.expected ? Math.round(variance.total.expected * 0.90) : 0);
  const totalHigh = intervalHigh ?? (variance.total?.expected ? Math.round(variance.total.expected * 1.15) : 0);
  const totalWithinInterval = totalActual >= totalLow && totalActual <= totalHigh;

  res.json({
    ...variance,
    intervalLow: totalLow,
    intervalHigh: totalHigh,
    withinPredictionInterval: totalWithinInterval,
    categories: enrichedCategories,
    total: {
      ...variance.total,
      intervalLow: totalLow,
      intervalHigh: totalHigh,
      withinPredictionInterval: totalWithinInterval,
    },
    so1Metadata: cycle.so1Metadata || {
      totalPredictedCost: totalPredictedCost || variance.total?.expected,
      intervalLow: totalLow,
      intervalHigh: totalHigh,
    },
  });
}));

export default router;
