import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { AuditLog } from '../models/AuditLog.js';

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN }
  );
}

export async function register({ name, email, password, role = 'farmer', phone, district }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('DUPLICATE_EMAIL', 'Email already registered', 409);

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, phone, district, role, passwordHash });

  await AuditLog.create({
    entity: 'User',
    entityId: user._id.toString(),
    action: 'create',
    userId: user._id.toString(),
    before: null,
    after: { _id: user._id, name, email, role },
  });

  const token = signToken(user);
  return { token, user: { _id: user._id, name, email, role } };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const valid = await user.verifyPassword(password);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const token = signToken(user);
  return { token, user: { _id: user._id, name: user.name, email, role: user.role } };
}

export async function getMe(userId) {
  const user = await User.findById(userId).select('-passwordHash -__v');
  if (!user || user.deletedAt) throw new AppError('NOT_FOUND', 'User not found', 404);
  return user;
}
