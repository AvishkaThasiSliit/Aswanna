import mongoose from 'mongoose';

const cropAccuracyHistorySchema = new mongoose.Schema({
  district: { type: String, required: true, index: true },
  crop: { type: String, required: true, index: true },
  season: { type: String, required: true, index: true },
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true, unique: true },
  predictedTotal: { type: Number, required: true, min: 0 },
  actualTotal: { type: Number, required: true, min: 0 },
  errorPct: { type: Number, required: true },
  closedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const CropAccuracyHistory = mongoose.model('CropAccuracyHistory', cropAccuracyHistorySchema);
