import mongoose from 'mongoose';

/**
 * ThresholdConfig – one document per cycle.
 * Defaults to 'tiered' mode as per Table 3.
 * CONFIRM WITH DoA: threshold values.
 */
const thresholdConfigSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true, unique: true, index: true },
  mode: { type: String, enum: ['tiered', 'single'], default: 'tiered' },
  single: { type: Number, default: 0.10 },
  // tiered mode per-category-group overrides
  stable: {
    attention:   { type: Number, default: 0.10 },
    significant: { type: Number, default: 0.15 },
  },
  volatile: {
    attention:   { type: Number, default: 0.07 },
    significant: { type: Number, default: 0.12 },
  },
}, { timestamps: true });

export const ThresholdConfig = mongoose.models.ThresholdConfig
  || mongoose.model('ThresholdConfig', thresholdConfigSchema);
