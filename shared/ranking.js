import { CROP_YIELDS } from './config/cropYields.js';
import { RECOMMENDATION_CONFIG } from './config/recommendationConfig.js';

/**
 * Pure function to compute crop ranking.
 *
 * @param {Array<{crop: string, predictedCost: number}>} candidates
 * @param {Object.<string, Array<number>>} accuracyHistoryMap Map of crop name to array of past errorPct values
 * @param {Object} [config] Custom config (k, priorError, penalty)
 * @returns {Array<Object>} Ranked crops array
 */
export function computeCropRanking(candidates = [], accuracyHistoryMap = {}, config = RECOMMENDATION_CONFIG) {
  const cfg = { ...RECOMMENDATION_CONFIG, ...config };

  // Calculate base metrics for each candidate
  const evaluated = candidates.map(c => {
    const crop = c.crop;
    const predictedCost = Number(c.predictedCost || 0);
    const expectedYield = CROP_YIELDS[crop] || 2000;
    const costEfficiency = expectedYield > 0 ? predictedCost / expectedYield : 0;

    const history = accuracyHistoryMap[crop] || [];
    const n = history.length;
    const meanError = n > 0 ? history.reduce((sum, e) => sum + e, 0) / n : 0;
    const shrunkError = (n * meanError + cfg.k * cfg.priorError) / (n + cfg.k);
    const reliability = Math.max(0, 1 - shrunkError);
    const score = costEfficiency * (1 + cfg.penalty * shrunkError);
    const coldStart = n === 0;

    return {
      crop,
      predictedCost,
      expectedYield,
      costEfficiency: Number(costEfficiency.toFixed(2)),
      meanError: Number(meanError.toFixed(4)),
      shrunkError: Number(shrunkError.toFixed(4)),
      reliability: Number(reliability.toFixed(4)),
      sampleSize: n,
      coldStart,
      score: Number(score.toFixed(4)),
    };
  });

  // 1. Cost-only ranking (ascending by costEfficiency, tie-break by crop name)
  const costOnlySorted = [...evaluated].sort((a, b) => {
    if (a.costEfficiency !== b.costEfficiency) {
      return a.costEfficiency - b.costEfficiency;
    }
    return a.crop.localeCompare(b.crop);
  });
  const costOnlyRankMap = {};
  costOnlySorted.forEach((item, index) => {
    costOnlyRankMap[item.crop] = index + 1;
  });

  // 2. Accuracy-weighted ranking (ascending by score, tie-break by crop name)
  const finalSorted = [...evaluated].sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.crop.localeCompare(b.crop);
  });

  return finalSorted.map((item, index) => {
    const accuracyRank = index + 1;
    const costOnlyRank = costOnlyRankMap[item.crop];
    
    let plainLanguageReason = '';
    if (item.coldStart) {
      plainLanguageReason = `No past history for this district/crop/season (cold-start fallback). Ranked solely by SO1 predicted cost-efficiency (${item.costEfficiency} LKR/kg).`;
    } else {
      plainLanguageReason = `Ranked #${accuracyRank} with ${(item.reliability * 100).toFixed(1)}% reliability based on ${item.sampleSize} past season(s). Phased error: ${(item.meanError * 100).toFixed(1)}%.`;
    }

    return {
      ...item,
      costOnlyRank,
      accuracyRank,
      plainLanguageReason,
    };
  });
}
