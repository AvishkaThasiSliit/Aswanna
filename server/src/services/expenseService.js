import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import { Cycle } from '../models/Cycle.js';
import { ActivityCode } from '../models/ActivityCode.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { audit } from './genericService.js';

import { calculateExpenseTotals } from '../../../shared/calc.js';
export { calculateExpenseTotals };

// ─── Validation: worked day with all-zero costs is rejected ───────────────────

function assertNotAllZero(expenseData) {
  if (expenseData.dayStatus === 'no_work') return; // no_work days are fine with zero costs
  const total = expenseData.totalAmount || 0;
  if (total === 0) {
    throw new AppError('ZERO_COST_WORKED_DAY', 'A worked day must have at least one non-zero cost', 422);
  }
}

// ─── Cycle-closed guard ───────────────────────────────────────────────────────

async function assertCycleOpen(cycleId) {
  const cycle = await Cycle.findById(cycleId);
  if (!cycle || cycle.deletedAt) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
  if (cycle.status === 'closed') throw new AppError('CYCLE_CLOSED', 'Cannot write to a closed cycle', 409);
  return cycle;
}

// ─── Create (idempotent via clientRequestId) ──────────────────────────────────

export const createExpense = async (cycleId, expenseData, userId) => {
  await assertCycleOpen(cycleId);

  // Normalise userId to ObjectId so the compound unique index works correctly
  const userOid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId.toString())
    : userId;

  // Idempotency: return existing record on retry.
  // Note: Idempotency lookup does not filter on deletedAt; soft-deleted records are returned with created: false to preserve strict idempotency for clientRequestId.
  if (expenseData.clientRequestId) {
    const existing = await Expense.findOne({ clientRequestId: expenseData.clientRequestId, createdBy: userOid });
    if (existing) return { expense: existing, created: false };
  }

  const processedData = calculateExpenseTotals({ ...expenseData });
  assertNotAllZero(processedData);

  processedData.cycleId = cycleId;
  processedData.createdBy = userOid;
  // Server always overrides totalAmount – client value is discarded
  const expense = new Expense(processedData);
  try {
    await expense.save();
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Expense.findOne({ clientRequestId: expenseData.clientRequestId, createdBy: userOid });
      if (existing) return { expense: existing, created: false };
    }
    throw err;
  }

  await audit({ entity: 'Expense', entityId: expense._id, action: 'create', userId: userOid, before: null, after: expense.toObject() });
  return { expense, created: true };
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateExpense = async (expenseId, expenseData, userId) => {
  const expense = await Expense.findOne({ _id: expenseId, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);

  await assertCycleOpen(expense.cycleId);

  const before = expense.toObject();
  const processedData = calculateExpenseTotals({ ...expense.toObject(), ...expenseData });
  assertNotAllZero(processedData);

  Object.assign(expense, processedData);
  await expense.save();
  await audit({ entity: 'Expense', entityId: expense._id, action: 'update', userId, before, after: expense.toObject() });
  return expense;
};

// ─── Soft delete ──────────────────────────────────────────────────────────────

export const deleteExpense = async (expenseId, userId) => {
  const expense = await Expense.findOne({ _id: expenseId, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);

  const cycle = await Cycle.findById(expense.cycleId);
  if (cycle && cycle.status === 'closed') throw new AppError('CYCLE_CLOSED', 'Cannot write to a closed cycle', 409);

  const before = expense.toObject();
  expense.deletedAt = new Date();
  await expense.save();
  await audit({ entity: 'Expense', entityId: expense._id, action: 'delete', userId, before, after: expense.toObject() });
  return expense;
};

// ─── Restore (within 10 seconds only) ────────────────────────────────────────

export const restoreExpense = async (expenseId, userId) => {
  const expense = await Expense.findOne({ _id: expenseId });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);
  if (!expense.deletedAt) throw new AppError('NOT_DELETED', 'Expense is not deleted', 400);

  const secondsAgo = (Date.now() - expense.deletedAt.getTime()) / 1000;
  if (secondsAgo > 10) {
    throw new AppError('RESTORE_WINDOW_EXPIRED', 'Restore window of 10 seconds has passed', 409);
  }

  const cycle = await Cycle.findById(expense.cycleId);
  if (cycle && cycle.status === 'closed') throw new AppError('CYCLE_CLOSED', 'Cannot write to a closed cycle', 409);

  const before = expense.toObject();
  expense.deletedAt = null;
  await expense.save();
  await audit({ entity: 'Expense', entityId: expense._id, action: 'update', userId, before, after: expense.toObject() });
  return expense;
};

// ─── Filtered list ────────────────────────────────────────────────────────────

export const listExpenses = async (query, ownerFilter) => {
  const {
    cycleId, search, category,
    from, to, minAmount, maxAmount,
    page = 1, pageSize = 20, sort = '-createdAt'
  } = query;

  const filter = { deletedAt: null, ...ownerFilter };

  if (cycleId) {
    filter.cycleId = mongoose.Types.ObjectId.isValid(cycleId)
      ? new mongoose.Types.ObjectId(cycleId)
      : cycleId;
  }
  if (from || to) {
    filter.entryDate = {};
    if (from) filter.entryDate.$gte = new Date(from);
    if (to) filter.entryDate.$lte = new Date(to);
  }
  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.totalAmount = {};
    if (minAmount !== undefined) filter.totalAmount.$gte = Number(minAmount);
    if (maxAmount !== undefined) filter.totalAmount.$lte = Number(maxAmount);
  }

  // Category filter: inputs.categoryTag OR top-level group (machinery/labour/other)
  if (category) {
    const topLevelGroups = ['machinery', 'labour', 'other'];
    if (topLevelGroups.includes(category)) {
      // Match records that have a non-zero subtotal for that group
      filter[`subtotals.${category}`] = { $gt: 0 };
    } else {
      // inputs.categoryTag match
      filter['inputs.categoryTag'] = category;
    }
  }

  // Text search on activity code (code or name), inputs.inputType, or other.description
  if (search) {
    const matchingActivityCodes = await ActivityCode.find({
      $or: [
        { code: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameSi: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    const actIds = matchingActivityCodes.map(a => a._id);

    filter.$or = [
      { 'other.description': { $regex: search, $options: 'i' } },
      { 'inputs.inputType': { $regex: search, $options: 'i' } },
      { activityCode: { $in: actIds } }
    ];
  }

  const sortObj = sort.startsWith('-')
    ? { [sort.slice(1)]: -1 }
    : { [sort]: 1 };

  const pageNum = Math.max(1, parseInt(page));
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
  const skip = (pageNum - 1) * pageSizeNum;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [items, total, totalsAgg] = await Promise.all([
    Expense.find(filter).sort(sortObj).skip(skip).limit(pageSizeNum).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSpending: { $sum: '$totalAmount' },
          todayExpense: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$entryDate', todayStart] },
                    { $lte: ['$entryDate', todayEnd] }
                  ]
                },
                '$totalAmount',
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  const totalSpending = totalsAgg[0]?.totalSpending || 0;
  const todayExpense = totalsAgg[0]?.todayExpense || 0;

  return {
    items,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
    totals: { count: total, totalSpending, todayExpense },
  };
};
