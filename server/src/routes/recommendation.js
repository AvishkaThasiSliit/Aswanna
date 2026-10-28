/**
 * Crop Recommendation API Route
 *
 * GET /api/crop-recommendation?district=Kurunegala&season=Yala
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCropRecommendations } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const district = (req.query.district || 'Kurunegala').toString();
  const season = (req.query.season || 'Yala').toString();
  const irrigation = (req.query.irrigation || 'Unspecified').toString();

  const result = await getCropRecommendations(district, season, irrigation);
  const items = result.items || result;
  const unavailable = result.unavailable || [];

  res.json({
    district,
    season,
    irrigation,
    count: items.length,
    items,
    unavailable,
  });
}));

export default router;
