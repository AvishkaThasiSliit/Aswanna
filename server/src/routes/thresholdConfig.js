/**
 * ThresholdConfig routes – one config document per cycle.
 *
 * GET  /api/threshold-config/:cycleId – get config (creates default if absent)
 * PUT  /api/threshold-config/:cycleId – replace config (admin/officer only)
 */

import { Router } from 'express';
import { ThresholdConfig } from '../models/ThresholdConfig.js';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { DEFAULT_THRESHOLDS } from '../../../shared/variance.js';

const router = Router();
router.use(requireAuth);

// GET – return existing or synthetic default
router.get('/:cycleId', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const doc = await ThresholdConfig.findOne({ cycleId: req.params.cycleId }).lean();
  if (doc) return res.json(doc);

  // Return default shape without writing to DB
  return res.json({
    cycleId: req.params.cycleId,
    mode: DEFAULT_THRESHOLDS.mode,
    stable:   { attention: DEFAULT_THRESHOLDS.stable.attention,   significant: DEFAULT_THRESHOLDS.stable.significant   },
    volatile: { attention: DEFAULT_THRESHOLDS.volatile.attention, significant: DEFAULT_THRESHOLDS.volatile.significant },
    _isDefault: true,
  });
}));

// PUT – upsert threshold config (officer or admin only)
router.put('/:cycleId', asyncHandler(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) {
    throw new AppError('FORBIDDEN', 'Only admins and officers can modify thresholds', 403);
  }

  const cycle = await Cycle.findOne({ _id: req.params.cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const { mode, stable, volatile: vol } = req.body;

  const doc = await ThresholdConfig.findOneAndUpdate(
    { cycleId: req.params.cycleId },
    {
      $set: {
        mode:     mode     || 'tiered',
        stable:   stable   || DEFAULT_THRESHOLDS.stable,
        volatile: vol      || DEFAULT_THRESHOLDS.volatile,
      },
    },
    { upsert: true, new: true }
  );

  res.json(doc);
}));

export default router;
