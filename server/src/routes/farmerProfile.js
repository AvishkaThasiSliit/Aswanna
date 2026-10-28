import { Router } from 'express';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { farmerSchema } from '../../../shared/formSchemas/farmer.js';
import { validateBody } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';
import { normalizePhone, sinhalaDigitsToAscii } from '../../../shared/validation/index.js';

async function filterFn(req) {
  const user = req.user;
  if (user.role === 'admin') return {};
  if (user.role === 'officer') {
    return { _id: { $in: user.assignedFarmerIds } };
  }
  // farmer: only their own profile
  const farmerId = await getCallerFarmerId(user);
  return farmerId ? { _id: farmerId } : { userId: user._id.toString() };
}

async function ownershipFn(user, doc) {
  if (user.role === 'admin') return;
  if (user.role === 'farmer' && doc.userId && doc.userId.toString() === user._id.toString()) return;
  await assertOwnership(user, { farmerId: doc._id });
}

async function assertUniqueNic(nic, excludeId = null) {
  if (!nic || !nic.trim()) return;
  const clean = sinhalaDigitsToAscii(nic.trim()).toUpperCase();
  const query = { nic: clean, deletedAt: null };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await FarmerProfile.findOne(query);
  if (existing) {
    throw new AppError('DUPLICATE_NIC', 'NIC is already registered to another farmer', 422, {
      nic: [{ code: 'DUPLICATE_NIC', key: 'validation.errors.duplicateNic', message: 'This NIC is already registered to another farmer' }],
    });
  }
}

const ctrl = makeCrudController({
  Model: FarmerProfile,
  label: 'FarmerProfile',
  filterFn,
  ownershipFn,
  beforeCreate: async (data, req) => {
    if (req.user.role === 'farmer') data.userId = req.user._id.toString();
    if (data.nic) {
      data.nic = sinhalaDigitsToAscii(data.nic.trim()).toUpperCase();
      await assertUniqueNic(data.nic);
    }
    if (data.phone) {
      data.phone = normalizePhone(data.phone);
    }
    return data;
  },
  beforeUpdate: async (doc, data) => {
    if (data.nic) {
      data.nic = sinhalaDigitsToAscii(data.nic.trim()).toUpperCase();
      await assertUniqueNic(data.nic, doc._id);
    }
    if (data.phone) {
      data.phone = normalizePhone(data.phone);
    }
    return data;
  },
});

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  validateBody(farmerSchema, { strict: true, allowedExtraKeys: ['userId', 'clientRequestId'] }),
  async (req, res, next) => {
    if (req.user.role === 'farmer') {
      const existing = await FarmerProfile.findOne({ userId: req.user._id, deletedAt: null });
      if (existing) {
        if (req.body.nic) {
          req.body.nic = sinhalaDigitsToAscii(req.body.nic.trim()).toUpperCase();
          await assertUniqueNic(req.body.nic, existing._id);
        }
        if (req.body.phone) {
          req.body.phone = normalizePhone(req.body.phone);
        }
        Object.assign(existing, req.body);
        await existing.save();
        const resp = existing.toObject ? existing.toObject() : existing;
        resp.warnings = req.warnings || [];
        return res.json(resp);
      }
    }
    return ctrl.create(req, res, next);
  }
);

router.put(
  '/:id',
  validateBody(farmerSchema, { strict: true, allowedExtraKeys: ['userId', 'clientRequestId'] }),
  ctrl.update
);

router.delete('/:id', ctrl.remove);

export default router;
