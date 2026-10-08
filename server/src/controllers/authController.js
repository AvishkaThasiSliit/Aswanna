import { z } from 'zod';
import { asyncHandler } from '../utils/errors.js';
import * as authService from '../services/authService.js';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['farmer', 'officer', 'admin']).optional(),
  phone: z.string().optional(),
  district: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.json(user);
});
