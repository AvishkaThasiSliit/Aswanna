/**
 * Alerts routes – CRUD + acknowledge
 *
 * GET  /api/alerts?cycleId=         – list alerts for a cycle
 * GET  /api/alerts/:id              – single alert
 * POST /api/alerts/:id/acknowledge  – farmer acknowledges an alert
 *
 * Alerts are created/updated by alertService – not by the client.
 */

import { Router } from 'express';
import { Alert } from '../models/Alert.js';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// ── List alerts for a cycle ───────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { cycleId, resolved, severity, tier } = req.query;
  if (!cycleId) throw new AppError('VALIDATION_ERROR', 'cycleId query param is required', 422);

  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const query = { cycleId };
  if (resolved === 'false') {
    query.resolvedAt = null;
  } else if (resolved === 'true') {
    query.resolvedAt = { $ne: null };
  }

  const requestedSeverity = severity || tier;
  if (requestedSeverity && requestedSeverity !== 'all') {
    query.tier = requestedSeverity;
  }

  const alerts = await Alert.find(query).sort({ updatedAt: -1 }).lean();
  res.json(alerts);
}));

// ── Get a single alert ────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id).lean();
  if (!alert) throw new AppError('NOT_FOUND', 'Alert not found', 404);

  const cycle = await Cycle.findById(alert.cycleId);
  await assertOwnership(req.user, { farmerId: cycle?.farmerId });

  res.json(alert);
}));

// ── Resolve an alert ──────────────────────────────────────────────────────────
router.post('/:id/resolve', asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) throw new AppError('NOT_FOUND', 'Alert not found', 404);

  const cycle = await Cycle.findById(alert.cycleId);
  await assertOwnership(req.user, { farmerId: cycle?.farmerId });

  alert.resolvedAt = new Date();
  await alert.save();
  res.json(alert);
}));

export default router;
