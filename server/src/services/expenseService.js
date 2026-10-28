import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import { Cycle } from '../models/Cycle.js';
import { ActivityCode } from '../models/ActivityCode.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { audit } from './genericService.js';
import { recomputeAlerts } from './alertService.js';

import { Alert } from '../models/Alert.js';
import { calculateExpenseTotals } from '../../../shared/calc.js';
export { calculateExpenseTotals };

// Synchronous alert recompute – runs in the same request
async function triggerAlerts(cycleId) {
  if (!cycleId) return null;
  try {
    return await recomputeAlerts(cycleId.toString());
  } catch (err) {
    console.warn('[alerts] recompute failed for cycle', cycleId, err.message);
    return null;
  }
}

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

import { VALIDATION_LIMITS } from '../../../shared/config/validationLimits.js';

export async function evaluateExpenseRulesAndWarnings(cycle, expenseData, excludeId = null) {
  const warnings = [];

  // 1. Cross-record: date within cycle
  if (expenseData.entryDate && cycle.startDate) {
    const entryD = new Date(expenseData.entryDate);
    const startD = new Date(cycle.startDate);
    const entryDay = new Date(Date.UTC(entryD.getUTCFullYear(), entryD.getUTCMonth(), entryD.getUTCDate()));
    const startDay = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()));
    if (entryDay < startDay) {
      throw new AppError('DATE_BEFORE_CYCLE', 'Expense date cannot be before cycle start date', 422, {
        entryDate: [{ code: 'DATE_BEFORE_CYCLE', key: 'validation.errors.dateBeforeCycle', message: 'Expense date cannot be before cycle start date' }],
      });
    }
    if (cycle.endDate) {
      const endD = new Date(cycle.endDate);
      const endDay = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate()));
      if (entryDay > endDay) {
        throw new AppError('DATE_AFTER_CYCLE', 'Expense date cannot be after cycle end date', 422, {
          entryDate: [{ code: 'DATE_AFTER_CYCLE', key: 'validation.errors.dateAfterCycle', message: 'Expense date cannot be after cycle end date' }],
        });
      }
    }
  }

  // 2. Cross-record: no_work vs worked conflict on the same date
  if (expenseData.entryDate) {
    const startOfDay = new Date(expenseData.entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(expenseData.entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const query = {
      cycleId: cycle._id,
      entryDate: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    };
    if (excludeId) query._id = { $ne: excludeId };

    const sameDayExpenses = await Expense.find(query);
    if (expenseData.dayStatus === 'no_work') {
      const hasWorked = sameDayExpenses.some(e => e.dayStatus === 'worked');
      if (hasWorked) {
        throw new AppError('WORKED_STATUS_CONFLICT', 'Cannot record no-work day when worked expenses already exist on this date', 422, {
          dayStatus: [{ code: 'WORKED_STATUS_CONFLICT', key: 'validation.errors.workedStatusConflict', message: 'Cannot record no-work day when worked expenses already exist on this date' }],
        });
      }
    } else if (expenseData.dayStatus === 'worked') {
      const hasNoWork = sameDayExpenses.some(e => e.dayStatus === 'no_work');
      if (hasNoWork) {
        throw new AppError('NO_WORK_STATUS_CONFLICT', 'Cannot record worked expense when a no-work day is already recorded on this date', 422, {
          dayStatus: [{ code: 'NO_WORK_STATUS_CONFLICT', key: 'validation.errors.noWorkStatusConflict', message: 'Cannot record worked expense when a no-work day is already recorded on this date' }],
        });
      }
    }
  }

  // 3. Cross-field: wage required when labour entered
  if (expenseData.labour?.hiredLabour > 0) {
    if (!expenseData.labour.dailyWage || expenseData.labour.dailyWage <= 0) {
      throw new AppError('WAGE_REQUIRED', 'Daily wage is required when hired labour is entered', 422, {
        'labour.dailyWage': [{ code: 'WAGE_REQUIRED', key: 'validation.errors.required', message: 'Daily wage is required when hired labour is entered' }],
      });
    }
  }

  // 4. Cross-field: other description required when other amount entered
  if (expenseData.other?.amount > 0) {
    if (!expenseData.other.description || !expenseData.other.description.trim()) {
      throw new AppError('DESCRIPTION_REQUIRED', 'Description is required when other expense amount is entered', 422, {
        'other.description': [{ code: 'DESCRIPTION_REQUIRED', key: 'validation.errors.required', message: 'Description is required when other expense amount is entered' }],
      });
    }
  }

  // 5. Cross-field: labour steps of 0.5
  ['familyLabour', 'hiredLabour'].forEach(field => {
    const val = expenseData.labour?.[field];
    if (val != null && val > 0) {
      if ((val * 2) % 1 !== 0) {
        throw new AppError('LABOUR_STEP_INVALID', `${field} must be in steps of 0.5`, 422, {
          [`labour.${field}`]: [{ code: 'LABOUR_STEP_INVALID', key: 'validation.errors.stepInvalid', message: 'Labour quantity must be in steps of 0.5' }],
        });
      }
    }
  });

  // 6. Warning: machinery cost vs unit price x quantity warning
  if (expenseData.machinery?.unitPrice > 0 && expenseData.machinery?.quantity > 0 && expenseData.machinery?.cost != null) {
    const expected = Math.round(expenseData.machinery.unitPrice * expenseData.machinery.quantity);
    if (Math.abs(expenseData.machinery.cost - expected) > 1) {
      warnings.push({
        code: 'MACHINERY_COST_MISMATCH',
        key: 'validation.warnings.machineryCostMismatch',
        message: `Machinery cost (${expenseData.machinery.cost}) does not match unit price x quantity (${expected})`,
      });
    }
  }

  // 7. Warning: unit-price plausibility warnings from config
  if (expenseData.labour?.dailyWage > 0) {
    const { min, max } = VALIDATION_LIMITS.expense.labour.wagePlausibility;
    if (expenseData.labour.dailyWage < min || expenseData.labour.dailyWage > max) {
      warnings.push({
        code: 'WAGE_PLAUSIBILITY',
        key: 'validation.warnings.wagePlausibility',
        message: `Daily wage (${expenseData.labour.dailyWage} LKR) is outside expected plausibility range (${min} - ${max} LKR)`,
      });
    }
  }

  // 8. Warning: max total daily cost warning
  if (expenseData.totalAmount > VALIDATION_LIMITS.expense.maxDailyTotalCostWarning) {
    warnings.push({
      code: 'DAILY_COST_HIGH',
      key: 'validation.warnings.dailyCostHigh',
      message: `Total daily expense exceeds expected threshold (${VALIDATION_LIMITS.expense.maxDailyTotalCostWarning} LKR)`,
    });
  }

  // 9. Warning: exact-duplicate expense warning
  if (expenseData.entryDate && expenseData.activityCode) {
    const startOfDay = new Date(expenseData.entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(expenseData.entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const dupQuery = {
      cycleId: cycle._id,
      entryDate: { $gte: startOfDay, $lte: endOfDay },
      activityCode: expenseData.activityCode,
      deletedAt: null,
    };
    if (excludeId) dupQuery._id = { $ne: excludeId };

    const duplicates = await Expense.find(dupQuery);
    const isExactDup = duplicates.some(d => d.totalAmount === expenseData.totalAmount);
    if (isExactDup) {
      warnings.push({
        code: 'EXACT_DUPLICATE_EXPENSE',
        key: 'validation.warnings.exactDuplicateExpense',
        message: 'An expense with identical date, activity code, and total amount already exists',
      });
    }
  }

  return warnings;
}

// ─── Create (idempotent via clientRequestId) ──────────────────────────────────

export const createExpense = async (cycleId, expenseData, userId) => {
  const cycle = await assertCycleOpen(cycleId);

  // Normalise userId to ObjectId so the compound unique index works correctly
  const userOid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId.toString())
    : userId;

  if (expenseData.clientRequestId) {
    const existing = await Expense.findOne({ clientRequestId: expenseData.clientRequestId, createdBy: userOid });
    if (existing) return { expense: existing, created: false, warnings: [] };
  }

  const processedData = calculateExpenseTotals({ ...expenseData });
  const warnings = await evaluateExpenseRulesAndWarnings(cycle, processedData);
  assertNotAllZero(processedData);

  processedData.cycleId = cycleId;
  processedData.createdBy = userOid;
  const expense = new Expense(processedData);
  try {
    await expense.save();
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Expense.findOne({ clientRequestId: expenseData.clientRequestId, createdBy: userOid });
      if (existing) return { expense: existing, created: false, warnings: [] };
    }
    throw err;
  }

  await audit({ entity: 'Expense', entityId: expense._id, action: 'create', userId: userOid, before: null, after: expense.toObject() });
  const variance = await triggerAlerts(cycleId);
  const alerts = await Alert.find({ cycleId, resolvedAt: null }).lean();
  return { expense, created: true, alerts, variance, warnings };
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateExpense = async (expenseId, expenseData, userId) => {
  const expense = await Expense.findOne({ _id: expenseId, deletedAt: null });
  if (!expense) throw new AppError('NOT_FOUND', 'Expense not found', 404);

  const cycle = await assertCycleOpen(expense.cycleId);

  const before = expense.toObject();
  const processedData = calculateExpenseTotals({ ...expense.toObject(), ...expenseData });
  const warnings = await evaluateExpenseRulesAndWarnings(cycle, processedData, expenseId);
  assertNotAllZero(processedData);

  Object.assign(expense, processedData);
  await expense.save();
  await audit({ entity: 'Expense', entityId: expense._id, action: 'update', userId, before, after: expense.toObject() });
  await triggerAlerts(expense.cycleId);
  return { expense, warnings };
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
  await triggerAlerts(expense.cycleId);
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
  await triggerAlerts(expense.cycleId);
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
    Expense.find(filter).sort(sortObj).skip(skip).limit(pageSizeNum).populate('activityCode', 'code nameEn nameSi').lean(),
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
