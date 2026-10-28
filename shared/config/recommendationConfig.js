/**
 * Recommendation Engine Configuration
 */
export const RECOMMENDATION_CONFIG = {
  k: 3,             // Shrinkage prior weight
  priorError: 0.15, // 15% prior error for cold start
  penalty: 2.0,     // Error penalty multiplier on cost-efficiency
};
