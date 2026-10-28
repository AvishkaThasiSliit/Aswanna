/**
 * Mock SO1 endpoint – REPLACE WITH REAL SO1 API
 *
 * GET /api/mock-so1/predict?crop&district&season
 *
 * Returns baseline predictions per category.
 * Expected values: seed 25000, fertilizer 45000, agrochemical 60000,
 *   labour 40000, machinery 25000, fuel 25000, irrigation 25000, other 0.
 * Total expected = 245000.
 * low  = expected × 0.90 (−10%)
 * high = expected × 1.15 (+15%)
 *
 * REPLACE WITH REAL SO1 API when available.
 */

import { Router } from 'express';

const router = Router();

export const CROP_BASELINES = {
  Paddy: { seed: 20000, fertilizer: 50000, labour: 70000, machinery: 40000, fuel: 20000, irrigation: 20000, agrochemical: 0, other: 0 }, // Total: 220,000
  Maize: { seed: 18000, fertilizer: 40000, labour: 50000, machinery: 30000, fuel: 12000, irrigation: 12000, agrochemical: 0, other: 0 }, // Total: 162,000
  Tomato: { seed: 25000, fertilizer: 45000, labour: 60000, machinery: 40000, fuel: 25000, irrigation: 25000, agrochemical: 25000, other: 0 }, // Total: 245,000
  Chili: { seed: 15000, fertilizer: 30000, labour: 45000, machinery: 20000, fuel: 11000, irrigation: 11000, agrochemical: 0, other: 0 }, // Total: 132,000
};

export const DEFAULT_BASELINE = {
  seed: 25000,
  fertilizer: 45000,
  agrochemical: 25000,
  labour: 60000,
  machinery: 40000,
  fuel: 25000,
  irrigation: 25000,
  other: 0,
};

/**
 * Pure in-process SO1 prediction stub for internal server and test use.
 * Returns baseline predictions per category.
 */
export function getMockSo1Predictions(crop = 'Tomato', district, season) {
  const expectedMap = CROP_BASELINES[crop] || DEFAULT_BASELINE;
  return Object.entries(expectedMap).map(([category, expected]) => ({
    category,
    expected,
    low: Math.round(expected * 0.90),
    high: Math.round(expected * 1.15),
  }));
}

router.get('/predict', (req, res) => {
  // REPLACE WITH REAL SO1 API: use req.query.crop / district / season
  // to call the real prediction service and return real values.
  const { crop = 'Tomato', district, season } = req.query;
  const predictions = getMockSo1Predictions(crop, district, season);
  res.json(predictions);
});

export default router;
