import { Cycle } from '../models/Cycle.js';
import { AppError } from '../utils/errors.js';
import { audit } from './genericService.js';
import { fetchAndStoreBaseline } from './baselineService.js';
import { CropAccuracyHistory } from '../models/CropAccuracyHistory.js';
import { computeVarianceForCycle } from './alertService.js';

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

  // Idempotent double-close support
  if (cycle.status === 'closed' && toStatus === 'closed') {
    return cycle;
  }

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

  // Fetch SO1 baseline when cycle goes active reliably in-process.
  if (toStatus === 'active') {
    const res = await fetchAndStoreBaseline(cycleId);
    cycle.baselineStatus = res.status;
    cycle.baselineSource = res.status === 'ready' ? 'SO1' : null;
    if (res.metadata) {
      cycle.so1Metadata = res.metadata;
    }
    await cycle.save();
  }

  // Record CropAccuracyHistory when cycle moves to 'closed'
  if (toStatus === 'closed') {
    const existing = await CropAccuracyHistory.findOne({ cycleId: cycle._id });
    if (!existing) {
      const variance = await computeVarianceForCycle(cycle._id).catch(() => null);
      const predictedTotal = variance?.total?.expected || 200000;
      const actualTotal = variance?.total?.actual || 0;
      const errorPct = predictedTotal > 0 ? Math.abs(actualTotal - predictedTotal) / predictedTotal : 0;

      const history = await CropAccuracyHistory.create({
        district: cycle.district || 'Kurunegala',
        crop: cycle.crop || 'Tomato',
        season: cycle.season || 'Yala',
        cycleId: cycle._id,
        predictedTotal,
        actualTotal,
        errorPct,
        closedAt: new Date()
      });

      await audit({
        entity: 'CropAccuracyHistory',
        entityId: history._id,
        action: 'create',
        userId,
        after: history.toObject()
      });
    }
  }

  return cycle;
}

export { TRANSITIONS };
