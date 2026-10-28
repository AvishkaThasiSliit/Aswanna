/**
 * server/src/services/so1Adapter.js
 * Adapter between SO3 financial tracking and the SO1 Cost of Cultivation service.
 * Handles crop alias normalization, sequential district fallback policy,
 * category disaggregation, acreage scaling, largest-remainder integer rounding,
 * and strict contract validation.
 */

import {
  SO1_CONFIG,
  SO1_CROP_ALIASES,
  SO1_DIRECT_CATEGORY_MAP,
  SO1_COMPOUND_SPLITS,
  SO3_CATEGORIES,
} from '../../../shared/config/so1Mapping.js';

/**
 * Validate mapped predictions array
 * Schema rules:
 * - Exactly 8 categories
 * - All numbers integers >= 0
 * - low <= expected <= high
 * - Sum of expected === totalTarget
 */
export function validateMappedPredictions(predictions, totalTarget) {
  if (!Array.isArray(predictions) || predictions.length !== 8) {
    throw new Error(`Predictions must be an array of exactly 8 categories, got ${predictions?.length}`);
  }

  const seen = new Set();
  let expectedSum = 0;

  for (const item of predictions) {
    if (!item.category || typeof item.category !== 'string') {
      throw new Error(`Invalid category field: ${JSON.stringify(item)}`);
    }
    if (seen.has(item.category)) {
      throw new Error(`Duplicate category in output: ${item.category}`);
    }
    seen.add(item.category);

    if (!Number.isInteger(item.expected) || item.expected < 0) {
      throw new Error(`Expected cost must be an integer >= 0 for ${item.category}, got ${item.expected}`);
    }
    if (!Number.isInteger(item.low) || item.low < 0) {
      throw new Error(`Low bound must be an integer >= 0 for ${item.category}, got ${item.low}`);
    }
    if (!Number.isInteger(item.high) || item.high < 0) {
      throw new Error(`High bound must be an integer >= 0 for ${item.category}, got ${item.high}`);
    }
    if (item.low > item.expected || item.expected > item.high) {
      throw new Error(
        `Range violation for ${item.category}: low (${item.low}) <= expected (${item.expected}) <= high (${item.high})`
      );
    }
    expectedSum += item.expected;
  }

  if (totalTarget !== undefined && expectedSum !== totalTarget) {
    throw new Error(
      `Largest-remainder sum invariant failed: sum(categories)=${expectedSum} !== totalTarget=${totalTarget}`
    );
  }

  return true;
}

export function isTimeoutError(err) {
  if (!err) return false;
  return (
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    err.code === 'ABORT_ERR' ||
    err.code === 'ETIMEDOUT' ||
    /timeout|aborted/i.test(err.message || '')
  );
}

export function isConnectionError(err) {
  if (!err) return false;
  const msg = err.message || '';
  const code = err.code || err.cause?.code || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENOTFOUND' ||
    /ECONNREFUSED|fetch failed|connect refused|network error|failed to fetch/i.test(msg)
  );
}

/**
 * Safely serialize error detail from SO1 service (string, object, or array)
 * so that '[object Object]' is never produced.
 */
export function serializeErrorDetail(detail, fallback = 'Unprocessable Entity') {
  if (detail === undefined || detail === null) return fallback;
  if (typeof detail === 'object') {
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  const str = String(detail);
  return str === '[object Object]' ? fallback : str;
}

/**
 * Deduplicate warning strings preserving insertion order
 */
export function dedupeWarnings(warnings = []) {
  const result = [];
  for (const w of warnings) {
    if (w === undefined || w === null) continue;
    const str = typeof w === 'object' ? serializeErrorDetail(w) : String(w);
    if (str && !result.includes(str)) {
      result.push(str);
    }
  }
  return result;
}

/**
 * Perform a single POST /predict call to SO1 service
 */
async function callSo1Api({ crop, district, season, irrigation, allow_extrapolation, fetchFn, baseUrl, timeoutMs }) {
  const customFetch = fetchFn || fetch;
  const url = `${baseUrl || SO1_CONFIG.baseUrl}/predict`;
  const timeout = timeoutMs || SO1_CONFIG.timeoutMs;

  const payload = {
    crop,
    district,
    season,
    irrigation_type: irrigation,
    reference_year: SO1_CONFIG.defaultReferenceYear,
    usd_lkr_rate: SO1_CONFIG.defaultUsdLkrRate,
    allow_extrapolation: Boolean(allow_extrapolation),
  };

  const response = await customFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    const errorDetail = serializeErrorDetail(
      errorBody.detail !== undefined ? errorBody.detail : errorBody,
      `SO1 API Error ${response.status}`
    );
    const err = new Error(errorDetail);
    err.status = response.status;
    err.body = errorBody;
    err.detail = errorDetail;
    throw err;
  }

  return await response.json();
}

/**
 * Map raw SO1 JSON response to SO3's 8 categories with Largest-Remainder rounding
 */
export function mapSo1ResponseToCategories(so1Data, acres = 1.0) {
  const predictedCost = Number(so1Data.predicted_cost);
  const intervalLow = Number(so1Data.interval_low);
  const intervalHigh = Number(so1Data.interval_high);
  const costBreakdown = so1Data.cost_breakdown || {};

  if (!Number.isFinite(predictedCost) || predictedCost <= 0) {
    throw new Error(`Invalid predicted_cost from SO1: ${so1Data.predicted_cost}`);
  }

  // 1. Direct 1:1 items
  const seedAmount = Number(costBreakdown['Seeds']?.estimated_cost || 0);
  const fertAmount = Number(costBreakdown['Fertilizer']?.estimated_cost || 0);
  const labourAmount = Number(costBreakdown['Cultivation Labour']?.estimated_cost || 0);
  const irrigAmount = Number(costBreakdown['Mechanized Irrigation']?.estimated_cost || 0);

  // 2. Compound splits (using placeholder percentages marked CONFIRM WITH SO1 LEAD)
  const landPrepAmount = Number(costBreakdown['Land Preparation']?.estimated_cost || 0);
  const fuelMachAmount = Number(costBreakdown['Fuel & Machinery']?.estimated_cost || 0);
  const combinedMachFuel = landPrepAmount + fuelMachAmount;

  const machineryAmount = combinedMachFuel * SO1_COMPOUND_SPLITS.machineryFuel.machinery;
  const fuelAmount = combinedMachFuel * SO1_COMPOUND_SPLITS.machineryFuel.fuel;

  const agroOtherAmount = Number(costBreakdown['Agrochemicals & Other']?.estimated_cost || 0);
  const agrochemicalAmount = agroOtherAmount * SO1_COMPOUND_SPLITS.agrochemicalOther.agrochemical;
  const otherAmount = agroOtherAmount * SO1_COMPOUND_SPLITS.agrochemicalOther.other;

  const unscaledBreakdown = {
    seed: seedAmount,
    fertilizer: fertAmount,
    agrochemical: agrochemicalAmount,
    labour: labourAmount,
    machinery: machineryAmount,
    fuel: fuelAmount,
    irrigation: irrigAmount,
    other: otherAmount,
  };

  const rawSum = Object.values(unscaledBreakdown).reduce((acc, v) => acc + v, 0);
  if (rawSum <= 0) {
    throw new Error('SO1 cost breakdown sum is zero or negative');
  }

  // Target total integer LKR scaled by acres
  const totalTarget = Math.round(predictedCost * acres);

  // Largest-Remainder Rounding (Hare-Niemeyer) for exact integer distribution
  const entries = SO3_CATEGORIES.map((cat, idx) => {
    const rawVal = unscaledBreakdown[cat] || 0;
    // Scale proportionally to guarantee matching the rounded total target
    const exact = (rawVal / rawSum) * totalTarget;
    const base = Math.floor(exact);
    const rem = exact - base;
    return { cat, rawVal, exact, base, rem, idx };
  });

  const baseSum = entries.reduce((s, e) => s + e.base, 0);
  const shortfall = totalTarget - baseSum;

  // Sort descending by remainder, tie-break by index
  entries.sort((a, b) => b.rem - a.rem || a.idx - b.idx);
  for (let i = 0; i < shortfall; i++) {
    entries[i].base += 1;
  }

  // Interval ratios relative to overall predicted cost
  const ratioLow = predictedCost > 0 ? intervalLow / predictedCost : 0.85;
  const ratioHigh = predictedCost > 0 ? intervalHigh / predictedCost : 1.15;

  const mappedCategories = SO3_CATEGORIES.map(cat => {
    const entry = entries.find(e => e.cat === cat);
    const expected = entry ? entry.base : 0;
    const low = Math.min(expected, Math.max(0, Math.round(expected * ratioLow)));
    const high = Math.max(expected, Math.round(expected * ratioHigh));

    const isDirect = Object.values(SO1_DIRECT_CATEGORY_MAP).includes(cat);

    return {
      category: cat,
      expected,
      low,
      high,
      derived: true,
      is_estimated_split: !isDirect,
    };
  });

  validateMappedPredictions(mappedCategories, totalTarget);

  return {
    categories: mappedCategories,
    totalTarget,
    intervalLow: Math.round(intervalLow * acres),
    intervalHigh: Math.round(intervalHigh * acres),
  };
}

/**
 * Primary Adapter Interface: getSo1Predictions
 * Implements the 3-step district fallback policy in order:
 * 1. Exact district (allow_extrapolation=false)
 * 2. 'Whole Island' (allow_extrapolation=false)
 * 3. allow_extrapolation=true (extrapolated)
 *
 * If all fail, returns { success: false, baselineStatus: 'missing' }
 */
export async function getSo1Predictions({
  crop = 'Tomato',
  district = 'Kandy',
  season = 'Maha',
  irrigation = 'Irrigated',
  acres = 1.0,
  fetchFn = null,
  baseUrl = null,
  timeoutMs = null,
}) {
  // 1. Normalize crop alias (e.g. Chili -> Green Chilli)
  const normalizedCrop = SO1_CROP_ALIASES[crop] || crop;
  const safeAcres = Number.isFinite(Number(acres)) && Number(acres) > 0 ? Number(acres) : 1.0;

  let so1Data = null;
  let districtPolicyUsed = null;
  const warnings = [];

  // Attempt 1: Exact District (strict empirical)
  try {
    so1Data = await callSo1Api({
      crop: normalizedCrop,
      district,
      season,
      irrigation,
      allow_extrapolation: false,
      fetchFn,
      baseUrl,
      timeoutMs,
    });
    districtPolicyUsed = 'exact';
  } catch (err1) {
    if (err1.status === 422) {
      warnings.push(`Exact district '${district}' returned 422: ${serializeErrorDetail(err1.body?.detail || err1.detail || err1.message)}`);

      // Attempt 2: Fallback to 'Whole Island'
      try {
        so1Data = await callSo1Api({
          crop: normalizedCrop,
          district: 'Whole Island',
          season,
          irrigation,
          allow_extrapolation: false,
          fetchFn,
          baseUrl,
          timeoutMs,
        });
        districtPolicyUsed = 'whole_island';
      } catch (err2) {
        if (err2.status === 422) {
          warnings.push(`Whole Island fallback returned 422: ${serializeErrorDetail(err2.body?.detail || err2.detail || err2.message)}`);

          // Attempt 3: Extrapolation permitted
          try {
            so1Data = await callSo1Api({
              crop: normalizedCrop,
              district,
              season,
              irrigation,
              allow_extrapolation: true,
              fetchFn,
              baseUrl,
              timeoutMs,
            });
            districtPolicyUsed = 'extrapolated';
          } catch (err3) {
            if (err3.status === 422 && district !== 'Whole Island') {
              try {
                so1Data = await callSo1Api({
                  crop: normalizedCrop,
                  district: 'Whole Island',
                  season,
                  irrigation,
                  allow_extrapolation: true,
                  fetchFn,
                  baseUrl,
                  timeoutMs,
                });
                districtPolicyUsed = 'extrapolated';
              } catch (err4) {
                return {
                  success: false,
                  baselineStatus: 'missing',
                  error: `All district policies failed for ${normalizedCrop} in ${district}: ${err4.message}`,
                  warnings: dedupeWarnings(warnings),
                  statusCode: err4.status || 422,
                  isTimeout: isTimeoutError(err4),
                  isConnectionError: isConnectionError(err4),
                };
              }
            } else {
              return {
                success: false,
                baselineStatus: 'missing',
                error: `All district policies failed for ${normalizedCrop} in ${district}: ${err3.message}`,
                warnings: dedupeWarnings(warnings),
                statusCode: err3.status || 422,
                isTimeout: isTimeoutError(err3),
                isConnectionError: isConnectionError(err3),
              };
            }
          }
        } else {
          return {
            success: false,
            baselineStatus: 'missing',
            error: `Whole Island call failed: ${err2.message}`,
            warnings: dedupeWarnings(warnings),
            statusCode: err2.status,
            isTimeout: isTimeoutError(err2),
            isConnectionError: isConnectionError(err2),
          };
        }
      }
    } else {
      return {
        success: false,
        baselineStatus: 'missing',
        error: `Exact district call failed: ${err1.message}`,
        warnings: dedupeWarnings(warnings),
        statusCode: err1.status,
        isTimeout: isTimeoutError(err1),
        isConnectionError: isConnectionError(err1),
      };
    }
  }

  try {
    const mapped = mapSo1ResponseToCategories(so1Data, safeAcres);

    if (so1Data.warning) {
      warnings.push(serializeErrorDetail(so1Data.warning));
    }
    if (so1Data.low_confidence_reason) {
      warnings.push(serializeErrorDetail(so1Data.low_confidence_reason));
    }

    return {
      success: true,
      baselineStatus: 'ready',
      predictions: mapped.categories,
      totalPredictedCost: mapped.totalTarget,
      intervalLow: mapped.intervalLow,
      intervalHigh: mapped.intervalHigh,
      rawPerAcreCost: Number(so1Data.predicted_cost),
      acres: safeAcres,
      metadata: {
        model_version: so1Data.model_version || 'extratrees_champion_v2',
        request_id: so1Data.request_id || null,
        reference_year: so1Data.reference_year || SO1_CONFIG.defaultReferenceYear,
        low_confidence: Boolean(so1Data.low_confidence),
        low_confidence_reason: so1Data.low_confidence_reason || null,
        breakdown_source: so1Data.breakdown_source || 'historical_district_crop_ratio',
        district_policy_used: districtPolicyUsed,
        derived: true,
        acreage_scaled: safeAcres !== 1.0,
        lag_saturation_detected: Boolean(so1Data.lag_saturation_detected),
        lag_saturation_note: so1Data.lag_saturation_note || null,
        warnings: dedupeWarnings(warnings),
      },
    };
  } catch (mappingErr) {
    return {
      success: false,
      baselineStatus: 'missing',
      error: `Mapping or validation error: ${mappingErr.message}`,
      warnings: dedupeWarnings(warnings),
    };
  }
}
