import { AppError } from '../utils/errors.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Generic paginated list helper.
 * @param {mongoose.Model} Model
 * @param {object} filter  – base mongoose filter (always includes deletedAt: null)
 * @param {object} opts    – { page, pageSize, sort, projection }
 */
export async function paginatedList(Model, filter, { page = 1, pageSize = 20, sort = { createdAt: -1 }, projection } = {}) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Model.find({ ...filter, deletedAt: null }).select(projection).sort(sort).skip(skip).limit(pageSize).lean(),
    Model.countDocuments({ ...filter, deletedAt: null }),
  ]);
  return { items, total, page, pageSize };
}

/**
 * Write an audit log entry for create/update/delete.
 */
export async function audit({ entity, entityId, action, userId, before = null, after }) {
  await AuditLog.create({ entity, entityId: entityId.toString(), action, userId: userId?.toString(), before, after });
}

/**
 * Generic soft-delete.
 */
export async function softDelete(doc, userId) {
  const before = doc.toObject();
  doc.deletedAt = new Date();
  await doc.save();
  await audit({ entity: doc.constructor.modelName, entityId: doc._id, action: 'delete', userId, before, after: doc.toObject() });
  return doc;
}

/**
 * Throw if resource not found or already soft-deleted.
 */
export function assertExists(doc, label = 'Resource') {
  if (!doc || doc.deletedAt) throw new AppError('NOT_FOUND', `${label} not found`, 404);
  return doc;
}
