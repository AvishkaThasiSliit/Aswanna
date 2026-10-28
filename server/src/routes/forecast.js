/**
 * server/src/routes/forecast.js
 *
 * GET /api/cycles/:id/forecast
 * Read-only, owner-isolated advisory forecasting endpoint.
 * Returns 404 if FORECAST_MODE === 'off'.
 * Does NOT generate or modify Alert documents.
 */

import { Router } from 'express';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership } from '../middleware/ownership.js';
import { computeForecastForCycle } from '../services/forecastService.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { ENV } from '../config/env.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const mode = process.env.FORECAST_MODE || ENV.FORECAST_MODE || 'off';
  if (mode === 'off') {
    throw new AppError('NOT_FOUND', 'Forecasting feature is disabled', 404);
  }

  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) {
    throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  }

  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const result = await computeForecastForCycle(cycle._id, mode);
  if (!result) {
    throw new AppError('NOT_FOUND', 'Forecast could not be generated for this cycle', 404);
  }

  res.json(result);
}));

export default router;
