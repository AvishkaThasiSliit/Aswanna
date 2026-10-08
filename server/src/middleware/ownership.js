import { Cycle } from '../models/Cycle.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { AppError } from '../utils/errors.js';

/**
 * assertOwnership – single shared policy function.
 *
 * Usage:
 *   await assertOwnership(req.user, { cycleId: cycle._id }) // expense context
 *   await assertOwnership(req.user, { farmerId: profile._id }) // farmer / land context
 *   await assertOwnership(req.user, { userId: profile.userId }) // user-level check
 *
 * Rules:
 *   admin  → always allowed
 *   officer → only for farmers in their assignedFarmerIds
 *   farmer  → only for records linked to their own FarmerProfile
 */
export async function assertOwnership(user, { farmerId, cycleId, userId } = {}) {
  if (user.role === 'admin') return; // admin sees all

  // Resolve farmerId from cycleId when needed
  let resolvedFarmerId = farmerId;
  if (!resolvedFarmerId && cycleId) {
    const cycle = await Cycle.findById(cycleId).select('farmerId');
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);
    resolvedFarmerId = cycle.farmerId?.toString();
  }

  if (user.role === 'officer') {
    const allowed = (user.assignedFarmerIds || []).map(String);
    // resolvedFarmerId is a FarmerProfile._id; officers store FarmerProfile ids
    if (!resolvedFarmerId || !allowed.includes(resolvedFarmerId.toString())) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    return;
  }

  if (user.role === 'farmer') {
    // Farmer's own FarmerProfile
    const profile = await FarmerProfile.findOne({ userId: user._id }).select('_id');
    if (!profile) throw new AppError('FORBIDDEN', 'Farmer profile not found', 403);

    // Check by userId directly (for user-scoped resources)
    if (userId && userId.toString() !== user._id.toString()) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    if (resolvedFarmerId && resolvedFarmerId.toString() !== profile._id.toString()) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    return;
  }

  throw new AppError('FORBIDDEN', 'Access denied', 403);
}

/**
 * Returns the FarmerProfile._id for the current farmer user, or null for admin/officer.
 */
export async function getCallerFarmerId(user) {
  if (user.role !== 'farmer') return null;
  const profile = await FarmerProfile.findOne({ userId: user._id }).select('_id');
  return profile?._id ?? null;
}
