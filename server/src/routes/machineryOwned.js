import { z } from 'zod';
import { Router } from 'express';
import { MachineryOwned } from '../models/MachineryOwned.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';

const createSchema = z.object({
  farmerId: z.string(),
  equipment: z.string().optional(),
  quantity: z.number().optional(),
  purchasedOn: z.object({
    year: z.number().optional(),
    month: z.number().optional(),
    day: z.number().optional(),
  }).optional(),
  purchaseValue: z.number().int().optional(),
  annotationNote: z.string().optional(),
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
  Model: MachineryOwned,
  label: 'MachineryOwned',
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
