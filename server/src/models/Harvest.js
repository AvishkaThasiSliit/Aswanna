import mongoose from 'mongoose';
const harvestSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
  round: Number,
  harvestDate: Date,
  yield: Number, // in kg
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientRequestId: { type: String }
}, { timestamps: true });

harvestSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

export const Harvest = mongoose.model('Harvest', harvestSchema);
