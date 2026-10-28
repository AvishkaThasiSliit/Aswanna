import { Router } from 'express';
import { Land } from '../models/Land.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { landSchema } from '../../../shared/formSchemas/land.js';
import { validateBody } from '../middleware/validate.js';
import { validateEntity } from '../../../shared/validation/index.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function checkDuplicateLandCode(farmerId, landCode, currentId = null) {
  const query = {
    farmerId,
    landCode: { $regex: new RegExp(`^${escapeRegex(landCode.trim())}$`, 'i') },
    deletedAt: null,
  };
  if (currentId) {
    query._id = { $ne: currentId };
  }
  const existing = await Land.findOne(query);
  if (existing) {
    throw new AppError('DUPLICATE', 'This Land Code is already in use by another of your lands', 409, {
      landCode: [{ code: 'DUPLICATE_LAND_CODE', key: 'validation.errors.duplicateLandCode', message: 'This Land Code is already in use by another of your lands' }],
    });
  }
}

const ctrl = makeCrudController({
  Model: Land,
  label: 'Land',
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
    await checkDuplicateLandCode(data.farmerId, data.landCode);
    return data;
  },
  beforeUpdate: async (doc, data) => {
    if (data.landCode) {
      await checkDuplicateLandCode(doc.farmerId, data.landCode, doc._id);
    }
    return data;
  },
});

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Batch save / sync lands for current farmer
router.post('/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one land is required', 422, {
      items: 'At least one land is required',
    });
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

  // Check intra-batch duplicate land codes (case-insensitive)
  const codeSet = new Set();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.landCode || !item.landCode.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Land code is required', 422, {
        [`items.${i}.landCode`]: 'Land code is required',
        landCode: 'Land code is required',
      });
    }
    const code = item.landCode.trim().toLowerCase();
    if (codeSet.has(code)) {
      throw new AppError('DUPLICATE', 'This Land Code is duplicated in your list', 409, {
        [`items.${i}.landCode`]: 'This Land Code is already in use by another of your lands',
        landCode: 'This Land Code is already in use by another of your lands',
      });
    }
    codeSet.add(code);
  }

  // Validate all items against schema and existing DB records
  const existingDocs = await Land.find({ farmerId, deletedAt: null });
  const validatedItems = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const valRes = validateEntity(landSchema, item, { strict: false });
    if (!valRes.isValid) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed for land', 422, valRes.errors);
    }
    await checkDuplicateLandCode(farmerId, item.landCode, item._id);
    validatedItems.push({ ...item, farmerId });
  }

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
    const newDoc = new Land({ ...item, farmerId, createdBy: req.user._id.toString() });
    await newDoc.save();
    keptIds.add(newDoc._id.toString());
    savedDocs.push(newDoc);
  }

  // Soft-delete items omitted from the batch sync
  for (const doc of existingDocs) {
    if (!keptIds.has(doc._id.toString())) {
      doc.deletedAt = new Date();
      doc.deletedBy = req.user._id.toString();
      await doc.save();
    }
  }

  res.status(200).json({ items: savedDocs, count: savedDocs.length });
}));

router.post(
  '/',
  validateBody(landSchema, { strict: true, allowedExtraKeys: ['farmerId', 'clientRequestId'] }),
  ctrl.create
);

router.put(
  '/:id',
  validateBody(landSchema, { strict: true, allowedExtraKeys: ['farmerId', 'clientRequestId'] }),
  ctrl.update
);

router.delete('/:id', ctrl.remove);

export default router;
