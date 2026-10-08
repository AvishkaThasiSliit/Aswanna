import { z } from 'zod';
import { Router } from 'express';
import { Cycle } from '../models/Cycle.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { transitionCycle } from '../services/cycleService.js';
import { getCycleSummary, getActivityCalendar } from '../services/summaryService.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const createSchema = z.object({
  farmerId: z.string(),
  landId: z.string().optional(),
  landCode: z.string().optional(),
  crop: z.string().optional(),
  season: z.enum(['Yala', 'Maha']).optional(),
  district: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'active', 'harvesting', 'closed']).optional(),
  baselineSource: z.enum(['SO1', 'SO2', 'none']).optional(),
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
  Model: Cycle,
  label: 'Cycle',
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

// Forward-only status transition
router.post('/:id/transition', asyncHandler(async (req, res) => {
  const { toStatus } = req.body;
  if (!toStatus) throw new AppError('VALIDATION_ERROR', 'toStatus is required', 422);

  // Ownership check before transition
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  const updated = await transitionCycle(req.params.id, toStatus, req.user._id);
  res.json(updated);
}));

// Summary endpoints
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });
  const summary = await getCycleSummary(req.params.id);
  res.json(summary);
}));

router.get('/:id/calendar', asyncHandler(async (req, res) => {
  const cycle = await Cycle.findOne({ _id: req.params.id, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });
  const calendar = await getActivityCalendar(req.params.id);
  res.json(calendar);
}));

export default router;
