/**
 * server/scripts/exportCycles.js
 *
 * Exports closed cycle histories and expense trajectories for ML phasing model fitting.
 * Schema complies with ml/src/fit_from_export.py and docs/api.md.
 *
 * Usage:
 *   node server/scripts/exportCycles.js [--out path/to/exported_cycles.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Cycle } from '../src/models/Cycle.js';
import { Baseline } from '../src/models/Baseline.js';
import { Expense } from '../src/models/Expense.js';
import { ENV } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORIES = ['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other'];

export async function exportClosedCycles() {
  const closedCycles = await Cycle.find({ status: 'closed', deletedAt: null }).lean();
  const exported = [];

  for (const cycle of closedCycles) {
    const cycleStart = cycle.startDate ? new Date(cycle.startDate) : null;
    const cycleEnd = cycle.endDate ? new Date(cycle.endDate) : null;
    const cycleLengthDays = (cycleStart && cycleEnd)
      ? Math.max(1, Math.ceil((cycleEnd - cycleStart) / 86400000))
      : 105;

    // Fetch baseline docs
    const baselineDocs = await Baseline.find({ cycleId: cycle._id }).lean();
    const categoryBaselines = {};
    let baselinePredicted = 0;

    for (const doc of baselineDocs) {
      categoryBaselines[doc.category] = doc.expected || 0;
      baselinePredicted += (doc.expected || 0);
    }
    if (cycle.so1Metadata?.totalPredictedCost) {
      baselinePredicted = cycle.so1Metadata.totalPredictedCost;
    }

    // Fetch expenses
    const expenses = await Expense.find({ cycleId: cycle._id, deletedAt: null }).sort({ entryDate: 1 }).lean();
    const unrolledExpenses = [];
    let totalSpend = 0;

    for (const exp of expenses) {
      const expDate = new Date(exp.entryDate);
      const day = cycleStart ? Math.max(1, Math.ceil((expDate - cycleStart) / 86400000)) : 1;

      // Inputs
      if (Array.isArray(exp.inputs)) {
        for (const inp of exp.inputs) {
          const cost = Number(inp.cost || 0);
          if (cost > 0) {
            unrolledExpenses.push({
              day,
              category: inp.categoryTag || 'other',
              amount: cost,
            });
            totalSpend += cost;
          }
        }
      }

      // Labour
      const labourCost = Number(exp.subtotals?.labour ?? exp.labour?.cost ?? 0);
      if (labourCost > 0) {
        unrolledExpenses.push({
          day,
          category: 'labour',
          amount: labourCost,
        });
        totalSpend += labourCost;
      }

      // Machinery
      const machineryCost = Number(exp.subtotals?.machinery ?? exp.machinery?.cost ?? 0);
      if (machineryCost > 0) {
        unrolledExpenses.push({
          day,
          category: 'machinery',
          amount: machineryCost,
        });
        totalSpend += machineryCost;
      }

      // Other
      const otherCost = Number(exp.other?.amount ?? 0);
      if (otherCost > 0) {
        unrolledExpenses.push({
          day,
          category: 'other',
          amount: otherCost,
        });
        totalSpend += otherCost;
      }
    }

    exported.push({
      cycle_id: cycle._id.toString(),
      crop: cycle.crop,
      season: cycle.season,
      district: cycle.district,
      cycle_length_days: cycleLengthDays,
      so1_baseline_predicted: Math.round(baselinePredicted),
      category_baselines: categoryBaselines,
      true_final_cost: Math.round(totalSpend),
      expenses: unrolledExpenses,
    });
  }

  return exported;
}

async function main() {
  const args = process.argv.slice(2);
  let outPath = path.resolve(__dirname, '../../ml/data/derived/exported_cycles.json');
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outPath = path.resolve(args[outIdx + 1]);
  }

  console.log(`Connecting to MongoDB at ${ENV.MONGODB_URI.replace(/:([^:@]{3,})@/, ':***@')}...`);
  await mongoose.connect(ENV.MONGODB_URI);

  try {
    const data = await exportClosedCycles();
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully exported ${data.length} closed cycles to: ${outPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
  });
}
