import mongoose from 'mongoose';
import { convertToAcres } from '../../../shared/units.js';

const landSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerProfile', required: true },
  landType: { type: String, enum: ['upland', 'lowland'] },
  district: String,
  agrarianServiceCentre: String,
  gnDivision: String,
  tenure: { 
    type: String, 
    enum: ['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private'] // confirm exact values against the paper
  },
  extentUnit: { type: String, enum: ['hectare', 'acre', 'rood', 'perch'] },
  extentValue: Number,
  extentAcres: Number,
  waterSourceType: { type: String, enum: ['irrigated', 'rainfed'] },
  irrigationSource: String,
  landCode: { type: String, required: true },
  deletedAt: { type: Date, default: null },
  createdBy: String,
  clientRequestId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

landSchema.index({ farmerId: 1, landCode: 1 }, { unique: true });

landSchema.pre('save', function(next) {
  if (this.isModified('extentValue') || this.isModified('extentUnit')) {
    this.extentAcres = convertToAcres(this.extentValue, this.extentUnit);
  }
  next();
});

export const Land = mongoose.model('Land', landSchema);
