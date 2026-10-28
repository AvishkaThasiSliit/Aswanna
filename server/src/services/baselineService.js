/**
 * baselineService.js – fetch SO1 predictions and persist as Baseline docs.
 *
 * Supports SO1_MODE=mock|real (defaulting to 'mock' in test/local environments).
 * In real mode, delegates to getSo1Predictions() adapter with timeout,
 * crop aliasing, 3-tier district fallback, acreage scaling, and largest-remainder rounding.
 */

import { Baseline } from '../models/Baseline.js';
import { Cycle } from '../models/Cycle.js';
import { AppError } from '../utils/errors.js';
import { getMockSo1Predictions } from '../routes/mockSo1.js';
import { getSo1Predictions } from './so1Adapter.js';
import { convertToAcres } from '../../../shared/units.js';

let _customSo1Fetcher = null;

/**
 * Configure a custom or mock SO1 fetcher (used in tests to simulate failures/overrides).
 * @param {Function|null} fn - (crop, district, season, acres) => Promise<result>
 */
export function setSo1Fetcher(fn) {
  _customSo1Fetcher = fn;
}

/**
 * Reset custom SO1 fetcher back to default mode.
 */
export function resetSo1Fetcher() {
  _customSo1Fetcher = null;
}

/**
 * Determine effective execution mode: 'real' | 'mock'
 */
export function getSo1Mode() {
  return process.env.SO1_MODE || (process.env.NODE_ENV === 'test' ? 'mock' : 'real');
}

/**
 * Fetch SO1 predictions for a cycle and upsert Baseline documents.
 * Called by cycleService when a cycle transitions to 'active'.
 * Never blocks cycle activation if SO1 fails or returns missing.
 *
 * @param {string} cycleId
 * @returns {Promise<Baseline[]>}
 */
export async function fetchAndStoreBaseline(cycleId) {
  const cycle = await Cycle.findById(cycleId);
  if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404);

  const acres = convertToAcres(cycle.extentValue, cycle.extentUnit) || 1.0;
  const mode = getSo1Mode();

  try {
    let result = null;

    // 1. Custom fetcher override (e.g. In unit tests simulating downstream failure)
    if (_customSo1Fetcher) {
      const customRes = await _customSo1Fetcher(cycle.crop, cycle.district, cycle.season, acres);
      // Support raw array from legacy test stubs
      if (Array.isArray(customRes)) {
        result = {
          success: true,
          baselineStatus: 'ready',
          predictions: customRes,
          metadata: {
            district_policy_used: 'mock',
            derived: false,
          },
        };
      } else {
        result = customRes;
      }
    } else if (mode === 'real') {
      // 2. Real SO1 API via so1Adapter
      result = await getSo1Predictions({
        crop: cycle.crop || 'Tomato',
        district: cycle.district || 'Kandy',
        season: cycle.season || 'Maha',
        irrigation: 'Irrigated',
        acres,
      });
    } else {
      // 3. In-process Mock Baseline
      const mockPredictions = getMockSo1Predictions(
        cycle.crop || 'Tomato',
        cycle.district,
        cycle.season
      );
      // Scale mock predictions by acres if acres !== 1
      const scaledMock = mockPredictions.map(p => ({
        category: p.category,
        expected: Math.round(p.expected * acres),
        low: Math.round(p.low * acres),
        high: Math.round(p.high * acres),
        derived: acres !== 1.0,
        is_estimated_split: false,
      }));

      const totalExpected = scaledMock.reduce((sum, p) => sum + p.expected, 0);

      result = {
        success: true,
        baselineStatus: 'ready',
        predictions: scaledMock,
        totalPredictedCost: totalExpected,
        intervalLow: Math.round(totalExpected * 0.90),
        intervalHigh: Math.round(totalExpected * 1.15),
        rawPerAcreCost: totalExpected / acres,
        acres,
        metadata: {
          model_version: 'proposal_baseline_v1',
          reference_year: 2025,
          low_confidence: false,
          breakdown_source: 'proposal_baseline',
          district_policy_used: 'mock',
          derived: acres !== 1.0,
          acreage_scaled: acres !== 1.0,
          warnings: [],
        },
      };
    }

    if (!result || !result.success || !Array.isArray(result.predictions) || result.predictions.length === 0) {
      const reason = result?.error || 'SO1 predictions unavailable';
      await Cycle.findByIdAndUpdate(cycleId, {
        baselineStatus: 'missing',
        baselineSource: null,
        so1Metadata: result?.metadata || null,
      });
      return {
        status: 'missing',
        rows: [],
        metadata: result?.metadata || null,
        reason,
      };
    }

    const { predictions, metadata = {}, totalPredictedCost, intervalLow, intervalHigh, rawPerAcreCost } = result;

    const ops = predictions.map(p => ({
      updateOne: {
        filter: { cycleId: cycle._id, category: p.category },
        update: {
          $set: {
            expected: p.expected,
            low: p.low,
            high: p.high,
            baselineSource: 'SO1',
            model_version: metadata.model_version,
            request_id: metadata.request_id,
            reference_year: metadata.reference_year,
            low_confidence: metadata.low_confidence || false,
            low_confidence_reason: metadata.low_confidence_reason || null,
            breakdown_source: metadata.breakdown_source,
            district_policy_used: metadata.district_policy_used,
            derived: p.derived || false,
            is_estimated_split: p.is_estimated_split || false,
            warnings: metadata.warnings || [],
            lag_saturation_detected: metadata.lag_saturation_detected || false,
            lag_saturation_note: metadata.lag_saturation_note || null,
            totalPredictedCost,
            intervalLow,
            intervalHigh,
            rawPerAcreCost,
            acres,
          },
        },
        upsert: true,
      },
    }));

    await Baseline.bulkWrite(ops);

    const fullCycleMetadata = {
      ...metadata,
      totalPredictedCost,
      intervalLow,
      intervalHigh,
      rawPerAcreCost,
      acres,
    };

    await Cycle.findByIdAndUpdate(cycleId, {
      baselineSource: 'SO1',
      baselineStatus: 'ready',
      so1Metadata: fullCycleMetadata,
    });

    const savedRows = await Baseline.find({ cycleId: cycle._id });
    return {
      status: 'ready',
      rows: savedRows,
      metadata: fullCycleMetadata,
      reason: null,
    };
  } catch (err) {
    await Cycle.findByIdAndUpdate(cycleId, {
      baselineStatus: 'missing',
      baselineSource: null,
    });
    return {
      status: 'missing',
      rows: [],
      metadata: null,
      reason: err.message,
    };
  }
}

/**
 * Return baselines for a cycle as a keyed object.
 * @param {string} cycleId
 * @returns {Promise<{[category]: {expected, low, high, is_estimated_split, derived}}>}
 */
export async function getBaselineMap(cycleId) {
  const docs = await Baseline.find({ cycleId }).lean();
  const map = {};
  for (const doc of docs) {
    map[doc.category] = {
      expected: doc.expected,
      low: doc.low,
      high: doc.high,
      is_estimated_split: Boolean(doc.is_estimated_split),
      derived: Boolean(doc.derived),
      low_confidence: Boolean(doc.low_confidence),
      district_policy_used: doc.district_policy_used,
    };
  }
  return map;
}
