import { DEMO_CROPS } from '../../../shared/config/cropYields.js';
import { computeCropRanking } from '../../../shared/ranking.js';
import { CropAccuracyHistory } from '../models/CropAccuracyHistory.js';
import { getSo1Predictions, isTimeoutError, isConnectionError } from './so1Adapter.js';
import { SO1_CONFIG } from '../../../shared/config/so1Mapping.js';

// Category baseline predicted cost map for demo crops (used exclusively when SO1_MODE=mock)
export const CROP_PREDICTED_TOTALS = {
  Paddy: 220000,
  Maize: 162000,
  Tomato: 245000,
  Chili: 132000,
};

// In-memory cache keyed by crop+district+season+irrigation+reference_year (TTL default 24h)
export const recommendationCache = new Map();

export function clearRecommendationCache() {
  recommendationCache.clear();
}

/**
 * Determine cache TTL for failed calls:
 * - connection errors and timeouts: no caching at all (0 ms)
 * - 422 'unsupported pair' (deterministic): up to 24h (never beyond 24h)
 * - 5xx / transient server errors: short TTL (default 30s, configurable via SO1_CONFIG.recommendationErrorCacheTtlMs)
 */
export function getErrorCacheTtl(errOrRes) {
  if (!errOrRes) return 0;

  // 1. Connection errors and timeouts: no caching at all
  if (errOrRes.isConnectionError || errOrRes.isTimeout) {
    return 0;
  }
  if (isTimeoutError(errOrRes) || isConnectionError(errOrRes)) {
    return 0;
  }
  const msg = errOrRes.message || errOrRes.reason || errOrRes.error || '';
  if (
    /ECONNREFUSED|fetch failed|connect refused|network error|failed to fetch/i.test(msg) ||
    /timeout|aborted/i.test(msg)
  ) {
    return 0;
  }

  const status = errOrRes.statusCode || errOrRes.status;

  // 2. 422 'unsupported pair' results: deterministic, cached up to 24h (never beyond 24h)
  if (status === 422 || /422|unprocessable/i.test(msg)) {
    const default24h = 24 * 60 * 60 * 1000;
    const configuredTtl = SO1_CONFIG.recommendationCacheTtlMs || default24h;
    return Math.min(configuredTtl, default24h);
  }

  // 3. 5xx, server failures, and other failed calls:
  // Must NOT be cached for more than a short TTL (default 30s, configurable via shared/config/so1Mapping.js)
  const defaultShortTtl = 30 * 1000;
  const shortTtl = Number.isFinite(SO1_CONFIG.recommendationErrorCacheTtlMs)
    ? SO1_CONFIG.recommendationErrorCacheTtlMs
    : defaultShortTtl;

  return shortTtl;
}

export function determineDataQuality(metadata) {
  if (!metadata) return 'observed';
  if (metadata.district_policy_used === 'extrapolated') {
    return 'extrapolated';
  }
  if (metadata.district_policy_used === 'whole_island' || metadata.breakdown_source === 'aliased_district_crop_ratio') {
    return 'regional_fallback';
  }
  if (metadata.low_confidence) {
    return 'extrapolated';
  }
  return 'observed';
}

/**
 * Get crop recommendations for a district, season, and irrigation regime.
 *
 * @param {string} district
 * @param {string} season
 * @param {string} irrigation ('Unspecified' | 'Irrigated' | 'Rainfed')
 * @param {Object} [options]
 * @param {Function} [options.fetchFn] Injected custom fetch for testing
 * @returns {Promise<Array<Object> & {items: Array<Object>, unavailable: Array<Object>}>}
 */
export async function getCropRecommendations(
  district = 'Kurunegala',
  season = 'Yala',
  irrigation = 'Unspecified',
  options = {}
) {
  const mode = process.env.SO1_MODE || (process.env.NODE_ENV === 'test' ? 'mock' : 'real');
  const fetchFn = options.fetchFn || null;

  let candidates = [];
  const unavailable = [];

  if (mode === 'mock') {
    // Mock mode keeps current numbers so existing hand-verified ranking tests pass unchanged
    candidates = DEMO_CROPS.map(crop => {
      const predictedCost = CROP_PREDICTED_TOTALS[crop] || 200000;
      return {
        crop,
        predictedCost,
        intervalLow: Math.round(predictedCost * 0.85),
        intervalHigh: Math.round(predictedCost * 1.15),
        dataQuality: 'observed',
        low_confidence: false,
        district_policy_used: 'exact',
        warnings: [],
      };
    });
  } else {
    // Real mode: Call getSo1Predictions for each candidate crop in parallel (1 acre per candidate)
    const referenceYear = SO1_CONFIG.defaultReferenceYear || 2025;
    const now = Date.now();
    const ttl = SO1_CONFIG.recommendationCacheTtlMs || 24 * 60 * 60 * 1000;

    const results = await Promise.all(
      DEMO_CROPS.map(async (crop) => {
        const cacheKey = `${crop}:${district}:${season}:${irrigation}:${referenceYear}`;
        const cached = recommendationCache.get(cacheKey);

        if (cached) {
          if (cached.expiresAt > now) {
            return { crop, ...cached.data, fromCache: true };
          } else {
            recommendationCache.delete(cacheKey);
          }
        }

        try {
          const so1Res = await getSo1Predictions({
            crop,
            district,
            season,
            irrigation,
            acres: 1.0,
            fetchFn,
            timeoutMs: SO1_CONFIG.timeoutMs,
          });

          if (so1Res.success && so1Res.baselineStatus === 'ready') {
            const data = {
              success: true,
              predictedCost: so1Res.totalPredictedCost,
              intervalLow: so1Res.intervalLow,
              intervalHigh: so1Res.intervalHigh,
              dataQuality: determineDataQuality(so1Res.metadata),
              low_confidence: Boolean(so1Res.metadata?.low_confidence),
              district_policy_used: so1Res.metadata?.district_policy_used || 'exact',
              warnings: so1Res.metadata?.warnings || [],
              so1Metadata: so1Res.metadata,
            };

            const successTtl = SO1_CONFIG.recommendationCacheTtlMs || 24 * 60 * 60 * 1000;
            recommendationCache.set(cacheKey, {
              data,
              expiresAt: now + successTtl,
            });

            return { crop, ...data, fromCache: false };
          } else {
            const failureData = {
              success: false,
              reason: so1Res.error || `SO1 baseline status: ${so1Res.baselineStatus || 'missing'}`,
              warnings: so1Res.warnings || [],
            };

            const errTtl = getErrorCacheTtl(so1Res);
            if (errTtl > 0) {
              recommendationCache.set(cacheKey, {
                data: failureData,
                expiresAt: now + errTtl,
              });
            }

            return {
              crop,
              ...failureData,
              fromCache: false,
            };
          }
        } catch (err) {
          const errData = {
            success: false,
            reason: err.message || 'SO1 service error',
            warnings: [err.message],
          };

          const errTtl = getErrorCacheTtl(err);
          if (errTtl > 0) {
            recommendationCache.set(cacheKey, {
              data: errData,
              expiresAt: now + errTtl,
            });
          }

          return {
            crop,
            ...errData,
            fromCache: false,
          };
        }
      })
    );

    for (const res of results) {
      if (res.success) {
        candidates.push({
          crop: res.crop,
          predictedCost: res.predictedCost,
          intervalLow: res.intervalLow,
          intervalHigh: res.intervalHigh,
          dataQuality: res.dataQuality,
          low_confidence: res.low_confidence,
          district_policy_used: res.district_policy_used,
          warnings: res.warnings,
          so1Metadata: res.so1Metadata,
        });
      } else {
        unavailable.push({
          crop: res.crop,
          reason: res.reason,
          warnings: res.warnings,
        });
      }
    }
  }

  // Fetch accuracy history for this district & season
  const historyDocs = await CropAccuracyHistory.find({
    district,
    season,
  }).lean();

  const accuracyHistoryMap = {};
  for (const doc of historyDocs) {
    if (!accuracyHistoryMap[doc.crop]) {
      accuracyHistoryMap[doc.crop] = [];
    }
    accuracyHistoryMap[doc.crop].push(doc.errorPct);
  }

  // Compute deterministic accuracy-weighted ranking using pure function in shared
  const ranked = computeCropRanking(candidates, accuracyHistoryMap);

  // Merge extra SO1 metadata fields onto ranked items
  const rankedWithMetadata = ranked.map(item => {
    const candidate = candidates.find(c => c.crop === item.crop);
    return {
      ...item,
      intervalLow: candidate?.intervalLow ?? Math.round(item.predictedCost * 0.85),
      intervalHigh: candidate?.intervalHigh ?? Math.round(item.predictedCost * 1.15),
      dataQuality: candidate?.dataQuality || 'observed',
      low_confidence: Boolean(candidate?.low_confidence),
      district_policy_used: candidate?.district_policy_used || 'exact',
      warnings: candidate?.warnings || [],
    };
  });

  return Object.assign([...rankedWithMetadata], {
    items: rankedWithMetadata,
    unavailable,
  });
}
