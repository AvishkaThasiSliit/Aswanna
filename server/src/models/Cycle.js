import mongoose from 'mongoose';
const cycleSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerProfile' },
  landId: { type: mongoose.Schema.Types.ObjectId, ref: 'Land' },
  landCode: String,
  crop: String,
  season: { type: String, enum: ['Yala', 'Maha'] },
  district: String,
  startDate: Date,
  endDate: Date,
  extentValue: Number,
  extentUnit: String,
  status: { type: String, enum: ['draft', 'active', 'harvesting', 'closed'] },
  baselineSource: { type: String, enum: ['SO1', 'SO2', 'none'] },
  baselineStatus: { type: String, enum: ['ready', 'missing', 'pending'], default: 'pending' },
  so1Metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  deletedAt: { type: Date, default: null },
  createdBy: String,
  clientRequestId: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export const Cycle = mongoose.model('Cycle', cycleSchema);
