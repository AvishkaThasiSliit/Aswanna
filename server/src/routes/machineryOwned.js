import { Router } from 'express';
import { MachineryOwned } from '../models/MachineryOwned.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { machinerySchema } from '../../../shared/formSchemas/machinery.js';
import { validateBody } from '../middleware/validate.js';
import { validateEntity } from '../../../shared/validation/index.js';

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
  Model: MachineryOwned,
  label: 'MachineryOwned',
  filterFn,
  ownershipFn,
  beforeCreate: async (data, req) => {
    if (!data.farmerId && req.user.role === 'farmer') {
      const fid = await getCallerFarmerId(req.user);
      if (fid) data.farmerId = fid.toString();
    }
    if (!data.farmerId) {
      throw new AppError('VALIDATION_ERROR', 'farmerId is required', 422, { farmerId: 'farmerId is required' });
    }
    return data;
  },
});

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Batch save / sync machinery rows for current farmer
router.post('/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    throw new AppError('VALIDATION_ERROR', 'items must be an array', 422);
  }

  let farmerId = req.body.farmerId;
  if (!farmerId && req.user.role === 'farmer') {
    const fid = await getCallerFarmerId(req.user);
    if (fid) farmerId = fid.toString();
  }
  if (!farmerId) {
    throw new AppError('VALIDATION_ERROR', 'farmerId is required', 422, { farmerId: 'farmerId is required' });
  }
  await assertOwnership(req.user, { farmerId });

  // Validate all items
  const validatedItems = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Skip completely empty rows
    if (!item.equipment && item.quantity == null && (!item.purchasedOn || item.purchasedOn.year == null) && item.purchaseValue == null && !item.annotationNote) {
      continue;
    }
    // If year is missing but month or day is provided, or equipment exists without year
    if (item.purchasedOn && (item.purchasedOn.month != null || item.purchasedOn.day != null) && !item.purchasedOn.year) {
      throw new AppError('VALIDATION_ERROR', 'Purchase year is required', 422, { [`items.${i}.purchasedOn.year`]: 'Purchase year is required' });
    }
    const valRes = validateEntity(machinerySchema, item, { strict: false });
    if (!valRes.isValid) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed for machinery item', 422, valRes.errors);
    }
    validatedItems.push({ ...item, farmerId });
  }

  // Update existing, create new, soft-delete excluded
  const existingDocs = await MachineryOwned.find({ farmerId, deletedAt: null });
  const keptIds = new Set();
  const savedDocs = [];

  for (const item of validatedItems) {
    if (item._id) {
      const doc = existingDocs.find((d) => d._id.toString() === item._id.toString());
      if (doc) {
        Object.assign(doc, item);
        await doc.save();
        keptIds.add(doc._id.toString());
        savedDocs.push(doc);
        continue;
      }
    }
    const newDoc = new MachineryOwned({ ...item, farmerId, createdBy: req.user._id.toString() });
    await newDoc.save();
    keptIds.add(newDoc._id.toString());
    savedDocs.push(newDoc);
  }

  for (const doc of existingDocs) {
    if (!keptIds.has(doc._id.toString())) {
      doc.deletedAt = new Date();
      await doc.save();
    }
  }

  res.json({ items: savedDocs });
}));

router.post(
  '/',
  validateBody(machinerySchema, { strict: true, allowedExtraKeys: ['farmerId', 'clientRequestId', 'purchasedOn'] }),
  ctrl.create
);

router.put(
  '/:id',
  validateBody(machinerySchema, { strict: true, allowedExtraKeys: ['farmerId', 'clientRequestId', 'purchasedOn'] }),
  ctrl.update
);

router.delete('/:id', ctrl.remove);

export default router;
