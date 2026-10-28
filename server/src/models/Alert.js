import mongoose from 'mongoose';

/**
 * Alert – one document per (cycleId, category, tier) snapshot.
 * Created/updated by alertService.recomputeAlerts().
 * Deduplication key: cycleId + category – only one live alert per category.
 */
const alertSchema = new mongoose.Schema({
  cycleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true, index: true },
  category:       { type: String, enum: ['seed','fertilizer','agrochemical','labour','machinery','fuel','irrigation','other','total'], required: true },
  tier:           { type: String, enum: ['normal','attention','significant'], required: true },
  variancePct:    { type: Number, required: true },           // signed decimal e.g. 0.12 = 12%
  expectedToDate: { type: Number, required: true },
  actualToDate:   { type: Number, required: true },
  dayOfCycle:     { type: Number, required: true },
  reason:         { type: String, default: null },              // e.g. 'no_baseline'
  resolvedAt:     { type: Date, default: null },              // set when resolved by user or when tier returns to normal
}, { timestamps: true });

// Only one live alert per category per cycle
alertSchema.index({ cycleId: 1, category: 1 }, { unique: true });

export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);
