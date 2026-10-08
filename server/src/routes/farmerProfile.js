import { z } from 'zod';
import { Router } from 'express';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';

const createSchema = z.object({
  name: z.string().min(1),
  dateOfBirth: z.string().optional(),
  nic: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  divisionalSecretariat: z.string().optional(),
  gnDivision: z.string().optional(),
  userId: z.string().optional(),
  clientRequestId: z.string().optional(),
});

const updateSchema = createSchema.partial();

async function filterFn(req) {
  const user = req.user;
  if (user.role === 'admin') return {};
  if (user.role === 'officer') {
    return { _id: { $in: user.assignedFarmerIds } };
  }
  // farmer: only their own profile
  const farmerId = await getCallerFarmerId(user);
  return farmerId ? { _id: farmerId } : { _id: null };
}

async function ownershipFn(user, doc, req) {
  await assertOwnership(user, { farmerId: doc._id });
}

const ctrl = makeCrudController({
  Model: FarmerProfile,
  label: 'FarmerProfile',
  createSchema,
  updateSchema,
  filterFn,
  ownershipFn,
  beforeCreate: async (data, req) => {
    // If a farmer creates their own profile, link it to their user
    if (req.user.role === 'farmer') data.userId = req.user._id.toString();
    return data;
  },
});

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
