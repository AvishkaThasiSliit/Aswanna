import { z } from 'zod';
import { Router } from 'express';
import { Land } from '../models/Land.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';

const createSchema = z.object({
  farmerId: z.string(),
  landCode: z.string().min(1),
  landType: z.enum(['upland', 'lowland']).optional(),
  district: z.string().optional(),
  agrarianServiceCentre: z.string().optional(),
  gnDivision: z.string().optional(),
  tenure: z.enum(['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private']).optional(),
  extentUnit: z.enum(['hectare', 'acre', 'rood', 'perch']).optional(),
  extentValue: z.number().optional(),
  waterSourceType: z.enum(['irrigated', 'rainfed']).optional(),
  irrigationSource: z.string().optional(),
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
  Model: Land,
  label: 'Land',
  createSchema,
  updateSchema,
  filterFn,
  ownershipFn,
});

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
