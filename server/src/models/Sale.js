import mongoose from 'mongoose';
const saleSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
  round: Number,
  saleDate: Date,
  quantitySold: Number,
  income: {
    type: Number,
    min: 0,
    validate: { validator: (v) => v == null || Number.isInteger(v), message: '{VALUE} must be an integer' }
  },
  soldTo: String,
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientRequestId: { type: String }
}, { timestamps: true });

saleSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

export const Sale = mongoose.model('Sale', saleSchema);
