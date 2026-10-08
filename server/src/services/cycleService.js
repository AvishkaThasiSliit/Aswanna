import { Cycle } from '../models/Cycle.js';
import { AppError } from '../utils/errors.js';
import { audit } from './genericService.js';

// Forward-only status state machine
const TRANSITIONS = {
  draft: ['active'],
  active: ['harvesting'],
  harvesting: ['closed'],
  closed: [],
};

export async function transitionCycle(cycleId, toStatus, userId) {
  const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const allowed = TRANSITIONS[cycle.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(
      'INVALID_TRANSITION',
      `Cannot transition from '${cycle.status}' to '${toStatus}'. Allowed: [${allowed.join(', ')}]`,
      422
    );
  }

  const before = cycle.toObject();
  cycle.status = toStatus;
  await cycle.save();
  await audit({ entity: 'Cycle', entityId: cycle._id, action: 'update', userId, before, after: cycle.toObject() });
  return cycle;
}

export { TRANSITIONS };
