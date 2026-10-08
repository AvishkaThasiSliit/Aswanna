import mongoose from 'mongoose';
const activityCodeSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  nameSi: String,
  nameEn: String,
  cropScope: [String],
  defaultCostGroup: String,
  isPlaceholder: Boolean,
  source: { type: String, enum: ['placeholder', 'DoA'] },
  active: Boolean,
  deletedAt: { type: Date, default: null },
  createdBy: String,
  clientRequestId: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export const ActivityCode = mongoose.model('ActivityCode', activityCodeSchema);
