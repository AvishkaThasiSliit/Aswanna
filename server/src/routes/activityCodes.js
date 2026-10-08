import { z } from 'zod';
import { Router } from 'express';
import { ActivityCode } from '../models/ActivityCode.js';
import { makeCrudController } from '../controllers/crudController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const createSchema = z.object({
  code: z.string().min(1),
  nameSi: z.string().optional(),
  nameEn: z.string().optional(),
  cropScope: z.array(z.string()).optional(),
  defaultCostGroup: z.string().optional(),
  isPlaceholder: z.boolean().optional(),
  source: z.enum(['placeholder', 'DoA']).optional(),
  active: z.boolean().optional(),
  clientRequestId: z.string().optional(),
});

const updateSchema = createSchema.partial();

const ctrl = makeCrudController({
  Model: ActivityCode,
  label: 'ActivityCode',
  createSchema,
  updateSchema,
  filterFn: null,
  ownershipFn: null,
});

const router = Router();
router.use(requireAuth);

// All roles can read
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Only admin can write
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

export default router;
