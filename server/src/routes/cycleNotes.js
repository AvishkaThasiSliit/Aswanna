import { Router } from 'express';
import { CycleNotes } from '../models/CycleNotes.js';
import { Cycle } from '../models/Cycle.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { audit, assertExists } from '../services/genericService.js';
import { notesSchema } from '../../../shared/formSchemas/notes.js';
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

function checkAreaNotHarvested(areaStr, cycle) {
  if (!areaStr || !cycle || cycle.extentValue == null) return;
  const match = String(areaStr).match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    const enteredVal = parseFloat(match[1]);
    if (enteredVal > Number(cycle.extentValue)) {
      throw new AppError('VALIDATION_ERROR', 'Area not harvested cannot exceed total land extent', 422, {
        areaNotHarvested: [{
          code: 'AREA_EXCEEDS_LAND_EXTENT',
          key: 'validation.errors.areaExceedsLandExtent',
          message: `Area not harvested (${enteredVal}) cannot exceed land extent (${cycle.extentValue})`,
        }],
      });
    }
  }
}

const router = Router();
router.use(requireAuth);

// ─── GET /api/cycle-notes ─────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const baseFilter = await filterFn(req);
  const notes = await CycleNotes.find({ ...baseFilter, deletedAt: null }).sort({ updatedAt: -1 }).lean();
  res.json({
    total: notes.length,
    items: notes,
    note: notes[0] || null,
  });
}));

// ─── GET /api/cycle-notes/:id ─────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await CycleNotes.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'CycleNotes');
  await assertOwnership(req.user, { cycleId: doc.cycleId });
  res.json(doc);
}));

// ─── POST /api/cycle-notes (Create or Upsert single record per cycle) ───────────
router.post(
  '/',
  validateBody(notesSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const data = req.body;

    if (!data.cycleId) {
      throw new AppError('VALIDATION_ERROR', 'cycleId is required', 422, { cycleId: 'cycleId is required' });
    }

    const cycle = await Cycle.findOne({ _id: data.cycleId, deletedAt: null });
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
    await assertOwnership(req.user, { farmerId: cycle.farmerId });

    if (cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    // Cross-record rule: area not harvested <= land extent
    if (data.areaNotHarvested) {
      checkAreaNotHarvested(data.areaNotHarvested, cycle);
    }

    // Idempotent check
    if (data.clientRequestId) {
      const existing = await CycleNotes.findOne({ createdBy: req.user._id, clientRequestId: data.clientRequestId });
      if (existing) {
        const resObj = existing.toObject ? existing.toObject() : { ...existing };
        resObj.warnings = req.warnings || [];
        return res.status(200).json(resObj);
      }
    }

    // Check if a note already exists for this cycle (single record per cycle constraint)
    let doc = await CycleNotes.findOne({ cycleId: data.cycleId, deletedAt: null });
    let status = 201;

    if (doc) {
      const before = doc.toObject();
      Object.assign(doc, {
        pestsAndDiseases: data.pestsAndDiseases ?? doc.pestsAndDiseases,
        otherCropLosses: data.otherCropLosses ?? doc.otherCropLosses,
        areaNotHarvested: data.areaNotHarvested ?? doc.areaNotHarvested,
        other: data.other ?? doc.other,
        clientRequestId: data.clientRequestId ?? doc.clientRequestId,
      });
      await doc.save();
      await audit({ entity: 'CycleNotes', entityId: doc._id, action: 'update', userId: req.user._id, before, after: doc.toObject() });
      status = 200;
    } else {
      data.createdBy = req.user._id.toString();
      doc = new CycleNotes(data);
      await doc.save();
      await audit({ entity: 'CycleNotes', entityId: doc._id, action: 'create', userId: req.user._id, before: null, after: doc.toObject() });
    }

    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warnings = req.warnings || [];
    res.status(status).json(resp);
  })
);

// ─── PUT /api/cycle-notes/:id ─────────────────────────────────────────────────
router.put(
  '/:id',
  validateBody(notesSchema, { strict: true, allowedExtraKeys: ['cycleId', 'clientRequestId'] }),
  asyncHandler(async (req, res) => {
    const doc = await CycleNotes.findOne({ _id: req.params.id, deletedAt: null });
    assertExists(doc, 'CycleNotes');
    await assertOwnership(req.user, { cycleId: doc.cycleId });

    const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
    if (cycle && cycle.status === 'closed') {
      throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
        cycle: 'Cycle is closed and read-only',
      });
    }

    const data = req.body;
    if (data.areaNotHarvested) {
      checkAreaNotHarvested(data.areaNotHarvested, cycle);
    }

    const before = doc.toObject();
    Object.assign(doc, data);
    await doc.save();
    await audit({ entity: 'CycleNotes', entityId: doc._id, action: 'update', userId: req.user._id, before, after: doc.toObject() });

    const resp = doc.toObject ? doc.toObject() : { ...doc };
    resp.warnings = req.warnings || [];
    res.json(resp);
  })
);

// ─── DELETE /api/cycle-notes/:id ──────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await CycleNotes.findOne({ _id: req.params.id, deletedAt: null });
  assertExists(doc, 'CycleNotes');
  await assertOwnership(req.user, { cycleId: doc.cycleId });

  const cycle = await Cycle.findOne({ _id: doc.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only',
    });
  }

  doc.deletedAt = new Date();
  doc.deletedBy = req.user._id.toString();
  await doc.save();
  await audit({ entity: 'CycleNotes', entityId: doc._id, action: 'delete', userId: req.user._id, before: doc.toObject(), after: null });
  res.json({ message: 'CycleNotes soft-deleted', id: doc._id });
}));

export default router;
