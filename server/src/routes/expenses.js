import { z } from 'zod';
import { Router } from 'express';
import { Expense } from '../models/Expense.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOwnership, getCallerFarmerId } from '../middleware/ownership.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import {
  createExpense, updateExpense, deleteExpense, restoreExpense, listExpenses,
} from '../services/expenseService.js';
import { Cycle } from '../models/Cycle.js';

const inputSchema = z.object({
  inputType: z.string().optional(),
  categoryTag: z.string().optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  cost: z.number().int().min(0).optional(),
});

const createSchema = z.object({
  cycleId: z.string(),
  entryDate: z.string().optional(),
  dayStatus: z.enum(['worked', 'no_work']).default('worked'),
  activityCode: z.string().optional(),
  inputs: z.array(inputSchema).optional(),
  machinery: z.object({
    method: z.string().optional(),
    unitPrice: z.number().int().min(0).optional(),
    quantity: z.number().min(0).optional(),
    cost: z.number().int().min(0).optional(),
  }).optional(),
  labour: z.object({
    familyLabour: z.number().min(0).optional(),
    hiredLabour: z.number().min(0).optional(),
    dailyWage: z.number().int().min(0).optional(),
    cost: z.number().int().min(0).optional(),
  }).optional(),
  other: z.object({
    description: z.string().optional(),
    amount: z.number().int().min(0).optional(),
  }).optional(),
  // Client may send totalAmount but server will recompute and ignore client value
  totalAmount: z.number().optional(),
  clientRequestId: z.string().optional(),
  source: z.enum(['manual', 'voice']).optional().default('manual'),
  reviewConfirmed: z.boolean().optional(),
});

const updateSchema = createSchema.partial().omit({ cycleId: true, clientRequestId: true });

// ─── Build ownership filter for list queries ───────────────────────────────────

async function buildOwnerFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'officer') {
    // Find cycleIds for assigned farmers
    const cycles = await Cycle.find({ farmerId: { $in: user.assignedFarmerIds }, deletedAt: null }).select('_id');
    return { cycleId: { $in: cycles.map(c => c._id) } };
  }
  // farmer
  const farmerId = await getCallerFarmerId(user);
  if (!farmerId) return { _id: null };
  const cycles = await Cycle.find({ farmerId, deletedAt: null }).select('_id');
  return { cycleId: { $in: cycles.map(c => c._id) } };
}

async function assertExpenseOwnership(user, expense) {
  await assertOwnership(user, { cycleId: expense.cycleId });
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function toCSV(items) {
  const headers = ['_id', 'cycleId', 'entryDate', 'dayStatus', 'totalAmount', 'createdAt'];
  const rows = items.map(item =>
    headers.map(h => {
      const val = item[h];
      if (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-/))) {
        return new Date(val).toISOString().slice(0, 10);
      }
      return val != null ? String(val).replace(/,/g, ';') : '';
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

const router = Router();
router.use(requireAuth);

// ─── GET /api/expenses/export.csv  (must be BEFORE /:id routes) ──────────────
router.get('/export.csv', asyncHandler(async (req, res) => {
  const ownerFilter = await buildOwnerFilter(req.user);
  const result = await listExpenses({ ...req.query, page: 1, pageSize: 10000 }, ownerFilter);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
  res.send(toCSV(result.items));
}));

// ─── GET /api/expenses ────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const ownerFilter = await buildOwnerFilter(req.user);
  const result = await listExpenses(req.query, ownerFilter);
  res.json(result);
}));

// ─── POST /api/expenses ───────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  // Ownership check on the target cycle
  const cycle = await Cycle.findOne({ _id: data.cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  await assertOwnership(req.user, { farmerId: cycle.farmerId });

  if (cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only'
    });
  }

  // Server-side enforcement of review confirmation invariant for voice expenses
  if (data.source === 'voice') {
    if (data.reviewConfirmed !== true) {
      throw new AppError(
        'UNREVIEWED_VOICE_EXPENSE',
        'Voice-derived expenses require explicit farmer review and confirmation before persistence',
        422
      );
    }
    if (!data.clientRequestId || typeof data.clientRequestId !== 'string' || !data.clientRequestId.trim()) {
      throw new AppError(
        'SUBMISSION_ID_REQUIRED',
        'Voice review confirmation must be bound to a unique clientRequestId submission token',
        422
      );
    }
  }

  const { expense, created, alerts, warnings } = await createExpense(data.cycleId, data, req.user._id);
  const resp = expense.toObject ? expense.toObject() : { ...expense };
  resp.alerts = alerts || [];
  resp.warnings = warnings || [];
  res.status(created ? 201 : 200).json(resp);
}));

// ─── GET /api/expenses/:id ────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);
  await assertExpenseOwnership(req.user, expense);
  res.json(expense);
}));

// ─── PUT /api/expenses/:id ────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);
  await assertExpenseOwnership(req.user, expense);

  const cycle = await Cycle.findOne({ _id: expense.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only'
    });
  }

  const data = updateSchema.parse(req.body);
  const result = await updateExpense(req.params.id, data, req.user._id);
  const updatedDoc = result.expense || result;
  const resp = updatedDoc.toObject ? updatedDoc.toObject() : { ...updatedDoc };
  resp.warnings = result.warnings || [];
  res.json(resp);
}));

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);
  await assertExpenseOwnership(req.user, expense);

  const cycle = await Cycle.findOne({ _id: expense.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only'
    });
  }

  await deleteExpense(req.params.id, req.user._id);
  res.json({ success: true });
}));

// ─── POST /api/expenses/:id/restore ──────────────────────────────────────────
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);
  await assertExpenseOwnership(req.user, expense);

  const cycle = await Cycle.findOne({ _id: expense.cycleId, deletedAt: null });
  if (cycle && cycle.status === 'closed') {
    throw new AppError('CYCLE_CLOSED', 'Cycle is closed and read-only', 409, {
      cycle: 'Cycle is closed and read-only'
    });
  }

  const restored = await restoreExpense(req.params.id, req.user._id);
  res.json(restored);
}));

export default router;
