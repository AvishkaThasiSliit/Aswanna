import { jest } from '@jest/globals';
import { convertToAcres } from '../../shared/units.js';
import { calculateExpenseTotals, createExpense, updateExpense, deleteExpense, listExpenses } from '../src/services/expenseService.js';
import { getCycleSummary, getActivityCalendar } from '../src/services/summaryService.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ActivityCode } from '../src/models/ActivityCode.js';

import mongoose from 'mongoose';

// A stable userId ObjectId shared by the service-level tests
const testUserId = new mongoose.Types.ObjectId();

describe('Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Unit conversion', () => {
    expect(convertToAcres(1, 'acre')).toBe(1);
    expect(convertToAcres(160, 'perch')).toBe(1);
    expect(convertToAcres(1, 'hectare')).toBeCloseTo(2.47105);
  });

  test('Day total with sample row', () => {
    const expenseData = {
      inputs: [{ cost: 8500 }],
      machinery: { cost: 3500 },
      labour: { familyLabour: 0, hiredLabour: 0, dailyWage: 0, cost: 5000 },
      other: { amount: 0 }
    };
    const processed = calculateExpenseTotals(expenseData);
    expect(processed.totalAmount).toBe(17000);
  });

  test('Seed check totals', () => {
    const costs = [18500, 31200, 37800, 25600, 16800, 15700];
    const total = costs.reduce((a, b) => a + b, 0);
    expect(total).toBe(145600);
    expect(total + 8500).toBe(154100);
    expect(220000 - total - 8500).toBe(65900);
  });

  test('Closed cycle rejects writes', async () => {
    const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'closed' });
    // dayStatus: 'no_work' so zero-cost guard is bypassed; closed cycle guard fires
    await expect(
      createExpense(cycle._id.toString(), { entryDate: new Date(), dayStatus: 'no_work', inputs: [] }, testUserId)
    ).rejects.toMatchObject({ code: 'CYCLE_CLOSED' });
  });

  test('Idempotency: the same clientRequestId twice creates one record', async () => {
    const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
    const expenseData = { clientRequestId: 'req-1', entryDate: new Date(), dayStatus: 'no_work', inputs: [], machinery: {}, labour: {}, other: {} };
    const first = await createExpense(cycle._id.toString(), expenseData, testUserId);
    const second = await createExpense(cycle._id.toString(), expenseData, testUserId);
    // createExpense now returns { expense, created }
    expect(first.expense._id.toString()).toBe(second.expense._id.toString());
    expect(second.created).toBe(false);
  });

  test('Soft delete keeps the record and writes an AuditLog', async () => {
    const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
    const { expense: exp } = await createExpense(
      cycle._id.toString(),
      { clientRequestId: 'req-del', entryDate: new Date(), dayStatus: 'no_work', inputs: [], machinery: {}, labour: {}, other: {} },
      testUserId
    );
    
    await deleteExpense(exp._id.toString(), testUserId);
    
    const expAfter = await Expense.findById(exp._id);
    expect(expAfter.deletedAt).toBeInstanceOf(Date);
    
    const logs = await AuditLog.find({ entityId: exp._id, action: 'delete' });
    expect(logs.length).toBe(1);
  });

  test('Calendar: invalid day check', async () => {
    const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });

    // Create real ActivityCodes (model only stores code, not descriptionSi/En)
    const activityCode1 = await ActivityCode.create({ code: 'A1', nameEn: 'Activity 1' });
    const activityCode2 = await ActivityCode.create({ code: 'A2', nameEn: 'Activity 2' });

    // Expenses must be valid under the model:
    //   - dayStatus 'worked'  →  activityCode required AND totalAmount > 0
    await Expense.create([
      {
        cycleId: cycle._id,
        entryDate: new Date('2026-06-30'),
        activityCode: activityCode1._id,
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'fertilizer', cost: 1000 }],
        machinery: {},
        labour: {},
        other: {},
        createdBy: testUserId,
      },
      {
        // June has 30 days; new Date('2026-06-31') rolls to 2026-07-01 in JS
        cycleId: cycle._id,
        entryDate: new Date('2026-06-31'),
        activityCode: activityCode2._id,
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'fertilizer', cost: 1000 }],
        machinery: {},
        labour: {},
        other: {},
        createdBy: testUserId,
      },
    ]);

    const calendar = await getActivityCalendar(cycle._id.toString());
    expect(calendar[2026][6][30]).toEqual(['A1']);
    expect(calendar[2026][7][1]).toEqual(['A2']);
  });

  describe('Phase 0.5 Model & Service Validations', () => {
    test('decimal cost rejected; negative quantity rejected', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const activityCode = await ActivityCode.create({ code: 'V1', nameEn: 'Validation Test' });

      // Decimal cost rejected
      const decimalCostExp = new Expense({
        cycleId: cycle._id,
        entryDate: new Date(),
        activityCode: activityCode._id,
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'fertilizer', cost: 100.5 }],
        createdBy: testUserId
      });
      await expect(decimalCostExp.validate()).rejects.toThrow();

      // Negative quantity rejected
      const negQuantityExp = new Expense({
        cycleId: cycle._id,
        entryDate: new Date(),
        activityCode: activityCode._id,
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'fertilizer', quantity: -5, cost: 100 }],
        createdBy: testUserId
      });
      await expect(negQuantityExp.validate()).rejects.toThrow();
    });

    test('no_work day without activityCode is valid; worked day without it is rejected', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });

      // no_work day without activityCode -> valid
      const noWorkExp = new Expense({
        cycleId: cycle._id,
        entryDate: new Date(),
        dayStatus: 'no_work',
        inputs: [],
        createdBy: testUserId
      });
      await expect(noWorkExp.validate()).resolves.toBeUndefined();

      // worked day without activityCode -> rejected
      const workedExp = new Expense({
        cycleId: cycle._id,
        entryDate: new Date(),
        dayStatus: 'worked',
        inputs: [{ categoryTag: 'fertilizer', cost: 500 }],
        createdBy: testUserId
      });
      await expect(workedExp.validate()).rejects.toThrow();
    });

    test('same clientRequestId from two different users creates 2 records; same user twice creates 1', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();
      const reqId = 'shared-client-req-id';

      const expData = { clientRequestId: reqId, entryDate: new Date(), dayStatus: 'no_work', inputs: [] };

      const resUser1a = await createExpense(cycle._id.toString(), expData, user1);
      const resUser1b = await createExpense(cycle._id.toString(), expData, user1);
      const resUser2 = await createExpense(cycle._id.toString(), expData, user2);

      expect(resUser1a.created).toBe(true);
      expect(resUser1b.created).toBe(false);
      expect(resUser1b.expense._id.toString()).toBe(resUser1a.expense._id.toString());

      expect(resUser2.created).toBe(true);
      expect(resUser2.expense._id.toString()).not.toBe(resUser1a.expense._id.toString());
    });

    test('MODEL ONLY (no service): new Expense with a wrong totalAmount and a wrong labour.cost is saved with the corrected values', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const activityCode = await ActivityCode.create({ code: 'MC1', nameEn: 'Model Correction Test' });

      const expense = new Expense({
        cycleId: cycle._id,
        entryDate: new Date(),
        activityCode: activityCode._id,
        dayStatus: 'worked',
        labour: { familyLabour: 2, hiredLabour: 3, dailyWage: 1000, cost: 9999 },
        totalAmount: 1111,
        createdBy: testUserId
      });

      await expense.save();

      expect(expense.labour.cost).toBe(5000);
      expect(expense.subtotals.labour).toBe(5000);
      expect(expense.totalAmount).toBe(5000);
    });

    test('Concurrent creates with identical clientRequestId expect one record and no error', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const user = new mongoose.Types.ObjectId();
      const reqId = 'concurrent-req-123';
      const expData = { clientRequestId: reqId, entryDate: new Date(), dayStatus: 'no_work', inputs: [] };

      const [res1, res2] = await Promise.all([
        createExpense(cycle._id.toString(), expData, user),
        createExpense(cycle._id.toString(), expData, user)
      ]);

      expect(res1.expense._id.toString()).toBe(res2.expense._id.toString());
      const createdCount = [res1.created, res2.created].filter(Boolean).length;
      expect(createdCount).toBe(1);

      const dbCount = await Expense.countDocuments({ createdBy: user, clientRequestId: reqId });
      expect(dbCount).toBe(1);
    });

    test('listExpenses: search matches activity code/name and inputs.inputType; totals computed via aggregation', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const actCode = await ActivityCode.create({ code: 'WEED_101', nameEn: 'Special Weeding' });

      await createExpense(cycle._id.toString(), {
        entryDate: new Date(),
        dayStatus: 'worked',
        activityCode: actCode._id.toString(),
        inputs: [{ categoryTag: 'seed', inputType: 'seed', cost: 1000 }],
        machinery: {},
        labour: {},
        other: {}
      }, testUserId);

      await createExpense(cycle._id.toString(), {
        entryDate: new Date('2025-01-01'),
        dayStatus: 'no_work',
        inputs: [],
        machinery: { method: 'Tractor', cost: 2000 },
        labour: {},
        other: { description: 'Snack', amount: 500 }
      }, testUserId);

      // Search by inputType "seed"
      const searchInputRes = await listExpenses({ search: 'seed' }, { createdBy: testUserId });
      expect(searchInputRes.items.length).toBe(1);
      expect(searchInputRes.items[0].inputs[0].inputType).toBe('seed');

      // Search by activity name "Weeding"
      const searchActRes = await listExpenses({ search: 'Weeding' }, { createdBy: testUserId });
      expect(searchActRes.items.length).toBe(1);

      // Aggregation totals test
      const allRes = await listExpenses({}, { createdBy: testUserId });
      expect(allRes.totals.totalSpending).toBe(3500);
      expect(allRes.totals.todayExpense).toBe(1000);
    });

    test('updateExpense: removing an input line and clearing labour update totals correctly', async () => {
      const cycle = await Cycle.create({ farmerId: new mongoose.Types.ObjectId(), landId: new mongoose.Types.ObjectId(), startDate: new Date(), status: 'active' });
      const actCode = await ActivityCode.create({ code: 'UPD_1', nameEn: 'Update Test' });

      const { expense: initialExp } = await createExpense(cycle._id.toString(), {
        entryDate: new Date(),
        dayStatus: 'worked',
        activityCode: actCode._id.toString(),
        inputs: [{ categoryTag: 'seed', cost: 1000 }, { categoryTag: 'fertilizer', cost: 2000 }],
        labour: { familyLabour: 1, dailyWage: 1000 },
        other: { amount: 500 }
      }, testUserId);

      expect(initialExp.totalAmount).toBe(4500);

      // Remove one input line and clear labour
      const updated = await updateExpense(initialExp._id.toString(), {
        inputs: [{ categoryTag: 'seed', cost: 1000 }],
        labour: { familyLabour: 0, hiredLabour: 0, dailyWage: 0, cost: 0 }
      }, testUserId);

      expect(updated.subtotals.inputs).toBe(1000);
      expect(updated.subtotals.labour).toBe(0);
      expect(updated.labour.cost).toBe(0);
      expect(updated.totalAmount).toBe(1500);
    });
  });
});
