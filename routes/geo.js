import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/geo/comfort-index.geojson:
 *   get:
 *     summary: Comfort Index GeoJSON (Mapbox용)
 *     tags: [GeoJSON]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection
 */
router.get('/comfort-index.geojson', async (req, res) => {
  try {
    const { date } = req.query;

    const comfortIndices = await ComfortIndex.find({ date });
    const unitIds = comfortIndices.map(ci => ci.unit_id);
    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { unitsMap[u._id] = u; });

    const features = comfortIndices
      .filter(ci => unitsMap[ci.unit_id] && unitsMap[ci.unit_id].geom)
      .map(ci => ({
        type: 'Feature',
        geometry: unitsMap[ci.unit_id].geom,
        properties: {
          unit_id: ci.unit_id,
          name: unitsMap[ci.unit_id].name || ci.unit_id,
          uci_score: ci.uci_score,
          uci_grade: ci.uci_grade
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'GeoJSON 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// GET /priority.geojson은 보조 기능이므로 제거됨
// 프론트엔드는 GET /api/v1/geo/comfort-index.geojson만 사용

export default router;

