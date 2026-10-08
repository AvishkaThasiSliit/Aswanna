import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['farmer', 'officer', 'admin'], default: 'farmer' },
  district: String,
  assignedFarmerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FarmerProfile' }],
  deletedAt: { type: Date, default: null },
  createdBy: String,
  clientRequestId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

userSchema.methods.verifyPassword = function(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function(plain) {
  return bcrypt.hash(plain, 12);
};

export const User = mongoose.model('User', userSchema);
