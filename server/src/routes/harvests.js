import { z } from 'zod';
import { Router } from 'express';
import { Harvest } from '../models/Harvest.js';
import { Cycle } from '../models/Cycle.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';

const createSchema = z.object({
  cycleId: z.string(),
  round: z.number().int().min(1),
  harvestDate: z.string().optional(),
  yield: z.number().min(0).optional(),
  clientRequestId: z.string().optional(),
});

const updateSchema = createSchema.partial().omit({ cycleId: true, clientRequestId: true });

async function filterFn(req) {
  const user = req.user;
  if (user.role === 'admin') return {};
  if (user.role === 'officer') {
    const cycles = await Cycle.find({ farmerId: { $in: user.assignedFarmerIds }, deletedAt: null }).select('_id');
    return { cycleId: { $in: cycles.map(c => c._id) } };
  }
  const farmerId = await getCallerFarmerId(user);
  if (!farmerId) return { _id: null };
  const cycles = await Cycle.find({ farmerId, deletedAt: null }).select('_id');
  return { cycleId: { $in: cycles.map(c => c._id) } };
}

async function ownershipFn(user, doc) {
  await assertOwnership(user, { cycleId: doc.cycleId });
}

const ctrl = makeCrudController({ Model: Harvest, label: 'Harvest', createSchema, updateSchema, filterFn, ownershipFn });

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
