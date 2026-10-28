import { Router } from 'express';
import { Harvest } from '../models/Harvest.js';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { paginatedList, audit, softDelete, assertExists } from '../services/genericService.js';
import { harvestSchema } from '../../../shared/formSchemas/harvest.js';
import { validateBody } from '../middleware/validate.js';

async function filterFn(req) {
  const user = req.user;
  const cycleId = req.query.cycleId;
  if (user.role === 'admin') return cycleId ? { cycleId } : {};
  if (user.role === 'officer') {
    const cycles = await Cycle.find({ farmerId: { $in: user.assignedFarmerIds }, deletedAt: null }).select('_id');
    const allowedIds = cycles.map(c => c._id.toString());
    if (cycleId && !allowedIds.includes(cycleId.toString())) return { _id: null };
    return cycleId ? { cycleId } : { cycleId: { $in: allowedIds } };
  }
  const farmerId = await getCallerFarmerId(user);
  if (!farmerId) return { _id: null };
  const cycles = await Cycle.find({ farmerId, deletedAt: null }).select('_id');
  const allowedIds = cycles.map(c => c._id.toString());
  if (cycleId && !allowedIds.includes(cycleId.toString())) return { _id: null };
  return cycleId ? { cycleId } : { cycleId: { $in: allowedIds } };
}

const router = Router();
router.use(requireAuth);

// ─── GET /api/harvests ────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const baseFilter = await filterFn(req);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
  const result = await paginatedList(Harvest, baseFilter, { page, pageSize, sort: { round: 1, createdAt: 1 } });
  res.json(result);
}));

// ─── GET /api/harvests/:id ────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await Harvest.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'Harvest');
  await assertOwnership(req.user, { cycleId: doc.cycleId });
  res.json(doc);
}));

// ─── POST /api/harvests ───────────────────────────────────────────────────────
router.post(
  '/',
  validateBody(harvestSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const data = req.body;

    if (!data.cycleId) {
      throw new AppError('VALIDATION_ERROR', 'cycleId is required', 422, { cycleId: 'cycleId is required' });
    }

    if (!data.yield || Number(data.yield) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Yield must be greater than 0', 422, {
        yield: 'Yield must be greater than 0',
      });
    }

    // Check target cycle
    const cycle = await Cycle.findOne({ _id: data.cycleId, deletedAt: null });
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
    await assertOwnership(req.user, { farmerId: cycle.farmerId });

    // Closed cycle check
    if (cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    // Validate harvest date not before cycle start date
    if (data.harvestDate && cycle.startDate) {
      const hDate = new Date(data.harvestDate);
      const sDate = new Date(cycle.startDate);
      if (new Date(hDate.toDateString()) < new Date(sDate.toDateString())) {
        throw new AppError('VALIDATION_ERROR', 'Harvest date cannot be before cycle start date', 422, {
          harvestDate: 'Harvest date cannot be before cycle start date',
        });
      }
    }

    // Idempotent check
    if (data.clientRequestId) {
      const existing = await Harvest.findOne({ createdBy: req.user._id, clientRequestId: data.clientRequestId });
      if (existing) {
        const resObj = existing.toObject ? existing.toObject() : { ...existing };
        resObj.warnings = req.warnings || [];
        return res.status(200).json(resObj);
      }
    }

    // Auto-number round if not provided
    if (!data.round) {
      const latestRoundDoc = await Harvest.findOne({ cycleId: data.cycleId, deletedAt: null }).sort({ round: -1 });
      data.round = latestRoundDoc ? latestRoundDoc.round + 1 : 1;
    }

    data.createdBy = req.user._id.toString();
    const doc = new Harvest(data);
    await doc.save();
    await audit({ entity: 'Harvest', entityId: doc._id, action: 'create', userId: req.user._id, before: null, after: doc.toObject() });
    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warnings = req.warnings || [];
    res.status(201).json(resp);
  })
);

// ─── PUT /api/harvests/:id ────────────────────────────────────────────────────
router.put(
  '/:id',
  validateBody(harvestSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const doc = await Harvest.findOne({ _id: req.params.id, deletedAt: null });
    assertExists(doc, 'Harvest');
    await assertOwnership(req.user, { cycleId: doc.cycleId });

    const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
    if (cycle && cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    const data = req.body;

    if (data.yield !== undefined && Number(data.yield) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Yield must be greater than 0', 422, {
        yield: 'Yield must be greater than 0',
      });
    }

    if (data.harvestDate && cycle?.startDate) {
      const hDate = new Date(data.harvestDate);
      const sDate = new Date(cycle.startDate);
      if (new Date(hDate.toDateString()) < new Date(sDate.toDateString())) {
        throw new AppError('VALIDATION_ERROR', 'Harvest date cannot be before cycle start date', 422, {
          harvestDate: 'Harvest date cannot be before cycle start date',
        });
      }
    }

    const before = doc.toObject();
    Object.assign(doc, data);
    await doc.save();
    await audit({ entity: 'Harvest', entityId: doc._id, action: 'update', userId: req.user._id, before, after: doc.toObject() });
    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warnings = req.warnings || [];
    res.json(resp);
  })
);

// ─── DELETE /api/harvests/:id ─────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await Harvest.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'Harvest');
  await assertOwnership(req.user, { cycleId: doc.cycleId });

  const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only',
    });
  }

  await softDelete(doc, req.user._id);
  await audit({ entity: 'Harvest', entityId: doc._id, action: 'delete', userId: req.user._id, before: doc.toObject(), after: null });
  res.json({ message: 'Harvest soft-deleted', id: doc._id });
}));

// ─── POST /api/harvests/:id/restore ───────────────────────────────────────────
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const doc = await Harvest.findOne({ _id: req.params.id });
  if (!doc) throw new AppError('NOT_FOUND', 'Harvest not found', 404);
  await assertOwnership(req.user, { cycleId: doc.cycleId });

  const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only',
    });
  }

  if (!doc.deletedAt) {
    throw new AppError('NOT_DELETED', 'Harvest is not deleted', 400);
  }

  const secondsAgo = (Date.now() - doc.deletedAt.getTime()) / 1000;
  if (secondsAgo > 10) {
    throw new AppError('RESTORE_WINDOW_EXPIRED', 'Restore window of 10 seconds has passed', 409);
  }

  doc.deletedAt = null;
  doc.deletedBy = null;
  await doc.save();
  await audit({ entity: 'Harvest', entityId: doc._id, action: 'update', userId: req.user._id, before: null, after: doc.toObject() });
  res.json(doc);
}));

export default router;
