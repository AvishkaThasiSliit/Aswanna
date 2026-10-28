import { Expense } from '../models/Expense.js';
import { Harvest } from '../models/Harvest.js';
import { Sale } from '../models/Sale.js';
import { Cycle } from '../models/Cycle.js';
import { AppError } from '../utils/errors.js';

/**
 * getCycleSummary – total cost, income, profit, costPerKg, per-category actuals.
 * Groups by inputs.categoryTag + machinery, labour, other lines.
 */
export async function getCycleSummary(cycleId) {
  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const expenses = await Expense.find({ cycleId, deletedAt: null }).lean();
  const harvests = await Harvest.find({ cycleId, deletedAt: null }).lean();
  const sales = await Sale.find({ cycleId, deletedAt: null }).lean();

  let totalCost = 0;
  const categoryActuals = {};

  for (const exp of expenses) {
    totalCost += exp.totalAmount || 0;

    // Group inputs by categoryTag
    if (Array.isArray(exp.inputs)) {
      for (const input of exp.inputs) {
        const tag = input.categoryTag || 'other';
        categoryActuals[tag] = (categoryActuals[tag] || 0) + (input.cost || 0);
      }
    }
    // Machinery line
    const mc = exp.subtotals?.machinery || exp.machinery?.cost || 0;
    if (mc) categoryActuals['machinery'] = (categoryActuals['machinery'] || 0) + mc;
    // Labour line
    const lc = exp.subtotals?.labour || exp.labour?.cost || 0;
    if (lc) categoryActuals['labour'] = (categoryActuals['labour'] || 0) + lc;
    // Other line
    const oc = exp.subtotals?.other || exp.other?.amount || 0;
    if (oc) categoryActuals['other'] = (categoryActuals['other'] || 0) + oc;
  }

  const totalHarvest = harvests.reduce((s, h) => s + (h.yield || 0), 0);
  const totalIncome = sales.reduce((s, sl) => s + (sl.income || 0), 0);
  const totalSold = sales.reduce((s, sl) => s + (sl.quantitySold || 0), 0);
  const profit = totalIncome - totalCost;
  const costPerKg = totalHarvest > 0 ? Number((totalCost / totalHarvest).toFixed(2)) : 0;
  const hasSales = sales.length > 0;
  const soldExceedsHarvest = totalSold > totalHarvest;

  return {
    cycleId,
    totalCost,
    totalIncome,
    profit,
    totalHarvest,
    totalSold,
    costPerKg,
    hasSales,
    soldExceedsHarvest,
    warningFlag: soldExceedsHarvest,
    categoryActuals,
    harvestCount: harvests.length,
    saleCount: sales.length,
    cycleStatus: cycle.status,
  };
}

/**
 * getActivityCalendar – returns nested { year: { month: { day: [actCode, ...] } } }
 * plus structured months grid with invalid days and per-day details.
 */
export async function getActivityCalendar(cycleId) {
  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const expenses = await Expense.find({ cycleId, deletedAt: null }).populate('activityCode').lean();

  const startDate = cycle.startDate ? new Date(cycle.startDate) : new Date();
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-indexed

  // Derive up to 13 consecutive months as on the paper form
  const months = [];
  for (let i = 0; i < 13; i++) {
    const curDate = new Date(startYear, startMonth + i, 1);
    const year = curDate.getFullYear();
    const month = curDate.getMonth() + 1; // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();
    const invalidDays = [];
    for (let day = daysInMonth + 1; day <= 31; day++) {
      invalidDays.push(day);
    }
    months.push({
      index: i + 1,
      year,
      month,
      monthName: curDate.toLocaleString('default', { month: 'short' }),
      daysInMonth,
      invalidDays,
    });
  }

  const calendar = {};
  const dayDetails = {}; // key: "YYYY-MM-DD"

  for (const exp of expenses) {
    if (!exp.entryDate) continue;
    const d = new Date(exp.entryDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!calendar[year]) calendar[year] = {};
    if (!calendar[year][month]) calendar[year][month] = {};
    if (!calendar[year][month][day]) calendar[year][month][day] = [];
    const code = exp.activityCode?.code || (exp.dayStatus === 'no_work' ? 'NW' : 'EXP');
    calendar[year][month][day].push(code);

    if (!dayDetails[dateKey]) {
      dayDetails[dateKey] = {
        date: dateKey,
        year,
        month,
        day,
        activityCodes: [],
        hasNoWork: false,
        expenses: [],
      };
    }
    if (!dayDetails[dateKey].activityCodes.includes(code)) {
      dayDetails[dateKey].activityCodes.push(code);
    }
    if (exp.dayStatus === 'no_work') {
      dayDetails[dateKey].hasNoWork = true;
    }
    dayDetails[dateKey].expenses.push({
      _id: exp._id,
      entryDate: exp.entryDate,
      activityCode: code,
      activityName: exp.activityCode?.nameEn || '',
      dayStatus: exp.dayStatus,
      totalAmount: exp.totalAmount || 0,
    });
  }

  return {
    ...calendar,
    cycleId,
    startDate: cycle.startDate,
    months,
    calendar,
    dayDetails,
  };
}
