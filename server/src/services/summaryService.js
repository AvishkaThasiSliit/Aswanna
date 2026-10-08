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
  const profit = totalIncome - totalCost;
  const costPerKg = totalHarvest > 0 ? totalCost / totalHarvest : 0;

  return { totalCost, totalIncome, profit, totalHarvest, costPerKg, categoryActuals };
}

/**
 * getActivityCalendar – returns nested { year: { month: { day: [actCode, ...] } } }
 */
export async function getActivityCalendar(cycleId) {
  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const expenses = await Expense.find({ cycleId, deletedAt: null }).populate('activityCode').lean();

  const calendar = {};
  for (const exp of expenses) {
    if (!exp.entryDate) continue;
    const d = new Date(exp.entryDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (!calendar[year]) calendar[year] = {};
    if (!calendar[year][month]) calendar[year][month] = {};
    if (!calendar[year][month][day]) calendar[year][month][day] = [];
    calendar[year][month][day].push(exp.activityCode?.code || 'unknown');
  }

  return calendar;
}
