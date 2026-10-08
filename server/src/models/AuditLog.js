import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema({
  entity: String,
  entityId: String,
  action: { type: String, enum: ['create', 'update', 'delete'] },
  userId: String,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now }
}, { timestamps: true });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
