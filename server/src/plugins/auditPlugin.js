import AuditLog from '../models/AuditLog.js';

export default function auditPlugin(schema, options) {
  schema.add({
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
    clientRequestId: { type: String, sparse: true, unique: true }
  });

  schema.pre('save', async function (next) {
    if (this.isNew) {
      await AuditLog.create({
        entity: this.constructor.modelName,
        entityId: this._id,
        action: 'create',
        userId: this.createdBy,
        after: this.toObject()
      });
    } else {
      // For updates
      // This is a simplified audit, in real world might need to capture original document
      // We will assume `this._original` is populated if needed, or we just log what we have
      await AuditLog.create({
        entity: this.constructor.modelName,
        entityId: this._id,
        action: 'update',
        userId: this.updatedBy || this.createdBy,
        after: this.toObject()
      });
    }
    next();
  });
  // soft delete methods should be implemented in services and they should create AuditLog manually or through a pre-update hook.
}
