import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { User } from '../models/User.js';

/**
 * requireAuth – validates the JWT and attaches req.user.
 * req.user = { _id, role, assignedFarmerIds }
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, ENV.JWT_SECRET);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  const user = await User.findById(payload.sub).select('-__v');
  if (!user || user.deletedAt) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401);
  }
  req.user = user;
  next();
});

/**
 * requireRole(...roles) – ensures the authenticated user has one of the given roles.
 */
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError('FORBIDDEN', 'Insufficient permissions', 403);
    }
    next();
  });
