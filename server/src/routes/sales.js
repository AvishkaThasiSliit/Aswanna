import { Router } from 'express';
import { Sale } from '../models/Sale.js';
import { Harvest } from '../models/Harvest.js';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { paginatedList, audit, softDelete, assertExists } from '../services/genericService.js';
import { saleSchema } from '../../../shared/formSchemas/sale.js';
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

// Helper: compute totalHarvest vs totalSold to generate warning flag
async function computeSaleWarning(cycleId) {
  const [harvestDocs, saleDocs] = await Promise.all([
    Harvest.find({ cycleId, deletedAt: null }).select('yield'),
    Sale.find({ cycleId, deletedAt: null }).select('quantitySold'),
  ]);

  const totalHarvest = harvestDocs.reduce((acc, h) => acc + (h.yield || 0), 0);
  const totalSold = saleDocs.reduce((acc, s) => acc + (s.quantitySold || 0), 0);
  const soldExceedsHarvest = totalSold > totalHarvest;
  return {
    totalHarvest,
    totalSold,
    soldExceedsHarvest,
    warning: soldExceedsHarvest ? 'Total quantity sold exceeds total quantity harvested' : null,
    warningFlag: soldExceedsHarvest,
  };
}

const router = Router();
router.use(requireAuth);

// ─── GET /api/sales ───────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const baseFilter = await filterFn(req);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
  const result = await paginatedList(Sale, baseFilter, { page, pageSize, sort: { round: 1, createdAt: 1 } });

  // Attach warning flag summary if cycleId filtered
  if (req.query.cycleId) {
    const warningInfo = await computeSaleWarning(req.query.cycleId);
    result.warningFlag = warningInfo.warningFlag;
    result.warning = warningInfo.warning;
    result.totalSold = warningInfo.totalSold;
    result.totalHarvest = warningInfo.totalHarvest;
  }

  res.json(result);
}));

// ─── GET /api/sales/:id ───────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await Sale.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'Sale');
  await assertOwnership(req.user, { cycleId: doc.cycleId });
  res.json(doc);
}));

// ─── POST /api/sales ──────────────────────────────────────────────────────────
router.post(
  '/',
  validateBody(saleSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const data = req.body;

    if (!data.cycleId) {
      throw new AppError('VALIDATION_ERROR', 'cycleId is required', 422, { cycleId: 'cycleId is required' });
    }

    if (data.quantitySold != null && Number(data.quantitySold) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Quantity sold must be greater than 0', 422, {
        quantitySold: 'Quantity sold must be greater than 0',
      });
    }

    if (data.income != null && (Number(data.income) < 0 || !Number.isInteger(Number(data.income)))) {
      throw new AppError('VALIDATION_ERROR', 'Income must be non-negative whole rupees', 422, {
        income: 'Income must be non-negative whole rupees',
      });
    }

    const cycle = await Cycle.findOne({ _id: data.cycleId, deletedAt: null });
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
    await assertOwnership(req.user, { farmerId: cycle.farmerId });

    if (cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    // Idempotent check
    if (data.clientRequestId) {
      const existing = await Sale.findOne({ createdBy: req.user._id, clientRequestId: data.clientRequestId });
      if (existing) {
        const warningInfo = await computeSaleWarning(data.cycleId);
        const resObj = existing.toObject ? existing.toObject() : { ...existing };
        resObj.warningFlag = warningInfo.warningFlag;
        resObj.warning = warningInfo.warning;
        resObj.warnings = req.warnings || [];
        return res.status(200).json(resObj);
      }
    }

    // Auto-number round if not provided
    if (!data.round) {
      const latestRoundDoc = await Sale.findOne({ cycleId: data.cycleId, deletedAt: null }).sort({ round: -1 });
      data.round = latestRoundDoc ? latestRoundDoc.round + 1 : 1;
    }

    data.createdBy = req.user._id.toString();
    const doc = new Sale(data);
    await doc.save();
    await audit({ entity: 'Sale', entityId: doc._id, action: 'create', userId: req.user._id, before: null, after: doc.toObject() });

    const warningInfo = await computeSaleWarning(data.cycleId);
    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warningFlag = warningInfo.warningFlag;
    resp.warning = warningInfo.warning;
    resp.soldExceedsHarvest = warningInfo.soldExceedsHarvest;

    const warnings = [...(req.warnings || [])];
    if (warningInfo.soldExceedsHarvest) {
      warnings.push({
        code: 'SOLD_EXCEEDS_HARVEST',
        key: 'validation.warnings.soldExceedsHarvest',
        message: 'Total quantity sold exceeds total quantity harvested',
      });
    }

    // Cross-record: sale date not before first harvest
    if (data.saleDate) {
      const firstHarvest = await Harvest.findOne({ cycleId: data.cycleId, deletedAt: null }).sort({ harvestDate: 1 });
      if (firstHarvest && firstHarvest.harvestDate) {
        const sDate = new Date(data.saleDate);
        const hDate = new Date(firstHarvest.harvestDate);
        if (new Date(sDate.toDateString()) < new Date(hDate.toDateString())) {
          warnings.push({
            code: 'SALE_BEFORE_FIRST_HARVEST',
            key: 'validation.warnings.saleBeforeFirstHarvest',
            message: 'Sale date is earlier than first harvest date',
          });
        }
      }
    }

    resp.warnings = warnings;
    res.status(201).json(resp);
  })
);

// ─── PUT /api/sales/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  validateBody(saleSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const doc = await Sale.findOne({ _id: req.params.id, deletedAt: null });
    assertExists(doc, 'Sale');
    await assertOwnership(req.user, { cycleId: doc.cycleId });

    const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
    if (cycle && cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    const data = req.body;

    if (data.quantitySold !== undefined && Number(data.quantitySold) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Quantity sold must be greater than 0', 422, {
        quantitySold: 'Quantity sold must be greater than 0',
      });
    }

    if (data.income !== undefined && (Number(data.income) < 0 || !Number.isInteger(Number(data.income)))) {
      throw new AppError('VALIDATION_ERROR', 'Income must be non-negative whole rupees', 422, {
        income: 'Income must be non-negative whole rupees',
      });
    }

    const before = doc.toObject();
    Object.assign(doc, data);
    await doc.save();
    await audit({ entity: 'Sale', entityId: doc._id, action: 'update', userId: req.user._id, before, after: doc.toObject() });

    const warningInfo = await computeSaleWarning(doc.cycleId);
    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warningFlag = warningInfo.warningFlag;
    resp.warning = warningInfo.warning;

    const warnings = [...(req.warnings || [])];
    if (warningInfo.soldExceedsHarvest) {
      warnings.push({
        code: 'SOLD_EXCEEDS_HARVEST',
        key: 'validation.warnings.soldExceedsHarvest',
        message: 'Total quantity sold exceeds total quantity harvested',
      });
    }
    if (data.saleDate) {
      const firstHarvest = await Harvest.findOne({ cycleId: doc.cycleId, deletedAt: null }).sort({ harvestDate: 1 });
      if (firstHarvest && firstHarvest.harvestDate) {
        const sDate = new Date(data.saleDate);
        const hDate = new Date(firstHarvest.harvestDate);
        if (new Date(sDate.toDateString()) < new Date(hDate.toDateString())) {
          warnings.push({
            code: 'SALE_BEFORE_FIRST_HARVEST',
            key: 'validation.warnings.saleBeforeFirstHarvest',
            message: 'Sale date is earlier than first harvest date',
          });
        }
      }
    }
    resp.warnings = warnings;
    res.json(resp);
  })
);

// ─── DELETE /api/sales/:id ────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await Sale.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'Sale');
  await assertOwnership(req.user, { cycleId: doc.cycleId });

  const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only',
    });
  }

  await softDelete(doc, req.user._id);
  await audit({ entity: 'Sale', entityId: doc._id, action: 'delete', userId: req.user._id, before: doc.toObject(), after: null });
  res.json({ message: 'Sale soft-deleted', id: doc._id });
}));

// ─── POST /api/sales/:id/restore ──────────────────────────────────────────────
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const doc = await Sale.findOne({ _id: req.params.id });
  if (!doc) throw new AppError('NOT_FOUND', 'Sale not found', 404);
  await assertOwnership(req.user, { cycleId: doc.cycleId });

  const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only',
    });
  }

  if (!doc.deletedAt) {
    throw new AppError('NOT_DELETED', 'Sale is not deleted', 400);
  }

  const secondsAgo = (Date.now() - doc.deletedAt.getTime()) / 1000;
  if (secondsAgo > 10) {
    throw new AppError('RESTORE_WINDOW_EXPIRED', 'Restore window of 10 seconds has passed', 409);
  }

  doc.deletedAt = null;
  doc.deletedBy = null;
  await doc.save();
  await audit({ entity: 'Sale', entityId: doc._id, action: 'update', userId: req.user._id, before: null, after: doc.toObject() });
  res.json(doc);
}));

export default router;
