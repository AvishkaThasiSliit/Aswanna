import { z } from 'zod';
import mongoose from 'mongoose';
import { Router } from 'express';
import { Cycle } from '../models/Cycle.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { transitionCycle } from '../services/cycleService.js';
import { fetchAndStoreBaseline } from '../services/baselineService.js';
import { getCycleSummary, getActivityCalendar } from '../services/summaryService.js';
import { asyncHandler, AppError } from '../utils/errors.js';

import { Land } from '../models/Land.js';
import { VALIDATION_LIMITS } from '../../../shared/config/validationLimits.js';

const createSchema = z.object({
  farmerId: z.string().optional(),
  landId: z.string().optional(),
  landCode: z.string().optional(),
  crop: z.string().optional(),
  season: z.enum(['Yala', 'Maha']).optional(),
  district: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  extentValue: z.number().optional(),
  extentUnit: z.string().optional(),
  status: z.enum(['draft', 'active', 'harvesting', 'closed']).optional(),
  baselineSource: z.enum(['SO1', 'SO2', 'none']).optional(),
  baselineStatus: z.enum(['ready', 'missing', 'pending']).optional(),
  clientRequestId: z.string().optional(),
});

const updateSchema = createSchema.partial();

async function filterFn(req) {
  const user = req.user;
  if (user.role === 'admin') return {};
  if (user.role === 'officer') return { farmerId: { $in: user.assignedFarmerIds } };
  const farmerId = await getCallerFarmerId(user);
  return farmerId ? { farmerId } : { _id: null };
}

async function ownershipFn(user, doc) {
  await assertOwnership(user, { farmerId: doc.farmerId });
}

const ctrl = makeCrudController({
  Model: Cycle,
  label: 'Cycle',
  createSchema,
  updateSchema,
  filterFn,
  ownershipFn,
});

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.list);

// Expose baselineStatus in GET /api/cycles/:id, support optional retry on read with ?retry=true
router.get('/:id', asyncHandler(async (req, res) => {
  const filter = filterFn ? await filterFn(req) : {};
  let cycle = await Cycle.findOne({ _id: req.params.id, ...filter, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  if (ownershipFn) await ownershipFn(req.user, cycle, req);

  // If explicit retry requested on read and baseline is missing, attempt in-process fetch
  if (req.query.retry === 'true' && cycle.status === 'active' && cycle.baselineStatus === 'missing') {
    const res = await fetchAndStoreBaseline(cycle._id);
    cycle.baselineStatus = res.status;
    cycle.baselineSource = res.status === 'ready' ? 'SO1' : null;
    if (res.metadata) cycle.so1Metadata = res.metadata;
    await cycle.save();
    cycle = await Cycle.findById(cycle._id);
  }

  res.json(cycle);
}));

router.post('/', asyncHandler(async (req, res) => {
  let data = createSchema.parse(req.body);
  if (!data.farmerId && req.user.role === 'farmer') {
    const fid = await getCallerFarmerId(req.user);
    if (fid) data.farmerId = fid.toString();
  }
  if (!data.farmerId) {
    throw new AppError('VALIDATION_ERROR', 'farmerId is required', 422, { farmerId: 'farmerId is required' });
  }
  await assertOwnership(req.user, { farmerId: data.farmerId });

  if (data.landId) {
    let land = null;
    if (mongoose.isValidObjectId(data.landId)) {
      land = await Land.findOne({ _id: data.landId, deletedAt: null });
    } else {
      land = await Land.findOne({ farmerId: data.farmerId, landCode: data.landId, deletedAt: null });
      if (land) {
        data.landId = land._id.toString();
      } else {
        delete data.landId;
      }
    }
    if (land) {
      if (!data.landCode) data.landCode = land.landCode;
      if (!data.district) data.district = land.district;
      if (!data.extentValue) data.extentValue = land.extentValue;
      if (!data.extentUnit) data.extentUnit = land.extentUnit;
    }
  }

  const requestedStatus = data.status || 'draft';

  // Cross-record rule: one active cycle per land
  if (data.landId && requestedStatus === 'active') {
    const existingActive = await Cycle.findOne({
      landId: data.landId,
      status: 'active',
      deletedAt: null,
    });
    if (existingActive) {
      throw new AppError('VALIDATION_ERROR', 'This land already has an active cultivation cycle', 422, {
        landId: [{ code: 'LAND_ACTIVE_CYCLE_EXISTS', key: 'validation.errors.landActiveCycleExists', message: 'This land already has an active cultivation cycle' }],
      });
    }
  }

  // Cross-field rule: season / start-month warning
  const warnings = [];
  if (data.season && data.startDate) {
    const startMonth = new Date(data.startDate).getUTCMonth() + 1;
    const allowedMonths = VALIDATION_LIMITS.cycle.seasonMonths[data.season] || [];
    if (allowedMonths.length > 0 && !allowedMonths.includes(startMonth)) {
      warnings.push({
        code: 'SEASON_MONTH_MISMATCH',
        key: 'validation.warnings.seasonStartMismatch',
        message: `Start date month is outside typical season window for ${data.season}`,
      });
    }
  }

  data.status = 'draft';
  data.createdBy = req.user._id.toString();
  const cycle = new Cycle(data);
  await cycle.save();

  if (requestedStatus === 'active') {
    await transitionCycle(cycle._id, 'active', req.user._id);
  }

  const finalCycle = await Cycle.findById(cycle._id);
  const resp = finalCycle.toObject ? finalCycle.toObject() : { ...finalCycle };
  resp.warnings = warnings;
  res.status(201).json(resp);
}));
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Retry baseline endpoint (accessible via POST /api/cycles/:id/retry-baseline or /baseline/retry)
const handleRetryBaseline = asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const result = await fetchAndStoreBaseline(cycle._id);
  cycle.baselineStatus = result.status;
  cycle.baselineSource = result.status === 'ready' ? 'SO1' : null;
  if (result.metadata) cycle.so1Metadata = result.metadata;
  await cycle.save();

  const updated = await Cycle.findById(cycle._id);
  if (result.status === 'ready') {
    res.json({
      success: true,
      baselineStatus: updated.baselineStatus,
      rows: result.rows?.length || 0,
      cycle: updated,
    });
  } else {
    res.status(502).json({
      success: false,
      baselineStatus: updated.baselineStatus || 'missing',
      error: result.reason || 'SO1 baseline unavailable',
      cycle: updated,
    });
  }
});

router.post('/:id/retry-baseline', handleRetryBaseline);
router.post('/:id/baseline/retry', handleRetryBaseline);

// Forward-only status transition
router.post('/:id/transition', asyncHandler(async (req, res) => {
  const { toStatus } = req.body;
  if (!toStatus) throw new AppError('VALIDATION_ERROR', 'toStatus is required', 422);

  // Ownership check before transition
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const updated = await transitionCycle(req.params.id, toStatus, req.user._id);
  res.json(updated);
}));

// Summary endpoints
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });
  const summary = await getCycleSummary(req.params.id);
  res.json(summary);
}));

router.get('/:id/calendar', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });
  const calendar = await getActivityCalendar(req.params.id);
  res.json(calendar);
}));

export default router;
