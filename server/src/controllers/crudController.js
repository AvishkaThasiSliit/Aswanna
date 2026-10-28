import { asyncHandler, AppError } from '../utils/errors.js';
import { paginatedList, audit, softDelete, assertExists } from '../services/genericService.js';

/**
 * makeCrudController – builds a standard CRUD controller for a Mongoose model.
 *
 * @param {object} opts
 * @param {mongoose.Model}   opts.Model
 * @param {string}           opts.label        – display name for error messages
 * @param {zod.Schema}       opts.createSchema  – Zod schema for create
 * @param {zod.Schema}       opts.updateSchema  – Zod schema for update (partial)
 * @param {Function}         opts.filterFn      – (req) => mongoose filter object
 * @param {Function}         opts.ownershipFn   – async (user, doc) => void (throws on deny)
 * @param {Function}         [opts.beforeCreate] – async (data, req) => mutated data
 */
export function makeCrudController({ Model, label, createSchema, updateSchema, filterFn, ownershipFn, beforeCreate }) {
  const list = asyncHandler(async (req, res) => {
    const baseFilter = filterFn ? await filterFn(req) : {};
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const result = await paginatedList(Model, baseFilter, { page, pageSize });
    res.json(result);
  });

  const getOne = asyncHandler(async (req, res) => {
    const filter = filterFn ? await filterFn(req) : {};
    const doc = await Model.findOne({ _id: req.params.id, ...filter, deletedAt: null });
    assertExists(doc, label);
    if (ownershipFn) await ownershipFn(req.user, doc, req);
    res.json(doc);
  });

  const create = asyncHandler(async (req, res) => {
    let data = createSchema && typeof createSchema.parse === 'function' ? createSchema.parse(req.body) : { ...req.body };
    if (beforeCreate) data = await beforeCreate(data, req);
    data.createdBy = req.user._id.toString();
    const doc = new Model(data);
    await doc.save();
    await audit({ entity: label, entityId: doc._id, action: 'create', userId: req.user._id, before: null, after: doc.toObject() });
    res.status(201).json(doc);
  });

  const update = asyncHandler(async (req, res) => {
    const filter = filterFn ? await filterFn(req) : {};
    const doc = await Model.findOne({ _id: req.params.id, ...filter, deletedAt: null });
    assertExists(doc, label);
    if (ownershipFn) await ownershipFn(req.user, doc, req);
    const before = doc.toObject();
    let data = updateSchema && typeof updateSchema.parse === 'function' ? updateSchema.parse(req.body) : { ...req.body };
    if (beforeUpdate) data = await beforeUpdate(doc, data, req);
    Object.assign(doc, data);
    await doc.save();
    await audit({ entity: label, entityId: doc._id, action: 'update', userId: req.user._id, before, after: doc.toObject() });
    res.json(doc);
  });

  const remove = asyncHandler(async (req, res) => {
    const filter = filterFn ? await filterFn(req) : {};
    const doc = await Model.findOne({ _id: req.params.id, ...filter, deletedAt: null });
    assertExists(doc, label);
    if (ownershipFn) await ownershipFn(req.user, doc, req);
    await softDelete(doc, req.user._id);
    res.json({ success: true });
  });

  return { list, getOne, create, update, remove };
}
