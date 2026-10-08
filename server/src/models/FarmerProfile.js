import mongoose from 'mongoose';
const farmerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  dateOfBirth: Date,
  nic: String,
  phone: String,
  address: String,
  district: String,
  divisionalSecretariat: String,
  gnDivision: String,
  deletedAt: { type: Date, default: null },
  createdBy: String,
  clientRequestId: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export const FarmerProfile = mongoose.model('FarmerProfile', farmerProfileSchema);
