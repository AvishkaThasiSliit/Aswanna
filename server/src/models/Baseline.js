import mongoose from 'mongoose';

/**
 * Baseline – expected cost per category per active cycle.
 * Fetched from SO1 (or a stub) when a cycle is activated.
 * baselineSource is always 'SO1' – the client must never fabricate this.
 */
const baselineSchema = new mongoose.Schema({
  cycleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true, index: true },
  category:       { type: String, enum: ['seed','fertilizer','agrochemical','labour','machinery','fuel','irrigation','other'], required: true },
  expected:       { type: Number, required: true, min: 0 },
  low:            { type: Number, required: true, min: 0 },   // expected × 0.90 or proportional 80% CI
  high:           { type: Number, required: true, min: 0 },   // expected × 1.15 or proportional 80% CI
  baselineSource: { type: String, enum: ['SO1','SO2','none'], default: 'SO1' },

  // SO1 integration metadata
  model_version:        { type: String },
  request_id:           { type: String },
  reference_year:       { type: Number },
  low_confidence:       { type: Boolean, default: false },
  low_confidence_reason:{ type: String },
  breakdown_source:     { type: String },
  district_policy_used: { type: String, enum: ['exact', 'whole_island', 'extrapolated', 'mock', 'none'] },
  derived:              { type: Boolean, default: false },
  is_estimated_split:   { type: Boolean, default: false },
  warnings:             { type: [String], default: [] },
  lag_saturation_detected: { type: Boolean, default: false },
  lag_saturation_note:  { type: String },
  totalPredictedCost:   { type: Number },
  intervalLow:          { type: Number },
  intervalHigh:         { type: Number },
  rawPerAcreCost:       { type: Number },
  acres:                { type: Number },
}, { timestamps: true });

baselineSchema.index({ cycleId: 1, category: 1 }, { unique: true });

export const Baseline = mongoose.models.Baseline || mongoose.model('Baseline', baselineSchema);
