import mongoose from 'mongoose';
const cycleNotesSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
  pestsAndDiseases: String,
  otherCropLosses: String,
  areaNotHarvested: String,
  other: String,
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientRequestId: { type: String }
}, { timestamps: true });

cycleNotesSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

export const CycleNotes = mongoose.model('CycleNotes', cycleNotesSchema);
