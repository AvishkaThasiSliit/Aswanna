import mongoose from 'mongoose';
import { CATEGORY_TAGS } from '../../../shared/categoryMap.js';
import { calculateExpenseTotals } from '../../../shared/calc.js';

const moneyField = {
  type: Number,
  min: 0,
  validate: {
    validator: (v) => v == null || Number.isInteger(v),
    message: '{VALUE} must be an integer'
  }
};

const quantityField = {
  type: Number,
  min: 0
};

const inputSchema = new mongoose.Schema({
  inputType: { type: String },
  categoryTag: { type: String, enum: CATEGORY_TAGS, required: true },
  quantity: quantityField,
  unit: String,
  cost: moneyField
}, { _id: false });

const machinerySchema = new mongoose.Schema({
  method: String,
  unitPrice: moneyField,
  quantity: quantityField,
  cost: moneyField
}, { _id: false });

const labourSchema = new mongoose.Schema({
  familyLabour: quantityField,
  hiredLabour: quantityField,
  dailyWage: moneyField,
  cost: moneyField
}, { _id: false });

const otherSchema = new mongoose.Schema({
  description: String,
  amount: moneyField
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true },
  entryDate: { type: Date, required: true },
  activityCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActivityCode',
    required: function() { return this.dayStatus !== 'no_work'; }
  },
  inputs: [inputSchema],
  machinery: machinerySchema,
  labour: labourSchema,
  other: otherSchema,
  subtotals: {
    inputs: { ...moneyField, default: 0 },
    machinery: { ...moneyField, default: 0 },
    labour: { ...moneyField, default: 0 },
    other: { ...moneyField, default: 0 }
  },
  totalAmount: { ...moneyField, default: 0 },
  dayStatus: { type: String, enum: ['worked', 'no_work'], default: 'worked' },
  syncStatus: { type: String, enum: ['synced', 'pending'], default: 'synced' },
  clientRequestId: { type: String },
  source: { type: String, enum: ['manual', 'voice'], default: 'manual' },
  reviewConfirmed: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

expenseSchema.index({ cycleId: 1, entryDate: -1 });
expenseSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

expenseSchema.pre('validate', function(next) {
  calculateExpenseTotals(this);
  if (this.dayStatus === 'worked' && (this.totalAmount == null || this.totalAmount <= 0)) {
    this.invalidate('totalAmount', 'Worked day requires totalAmount > 0');
  }
  next();
});

export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
