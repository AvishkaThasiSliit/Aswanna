import mongoose from 'mongoose';
const machineryOwnedSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerProfile' },
  equipment: String,
  quantity: Number,
  purchasedOn: {
    year: Number,
    month: Number,
    day: Number
  },
  purchaseValue: {
    type: Number,
    min: 0,
    validate: { validator: (v) => v == null || Number.isInteger(v), message: '{VALUE} must be an integer' }
  },
  annotationNote: String, // TODO: Unread handwritten annotation from DoA paper
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientRequestId: { type: String }
}, { timestamps: true });

machineryOwnedSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

export const MachineryOwned = mongoose.model('MachineryOwned', machineryOwnedSchema);
