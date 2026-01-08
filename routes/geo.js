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

/**
 * @swagger
 * /api/v1/geo/priority.geojson:
 *   get:
 *     summary: Priority Queue GeoJSON (Mapbox용)
 *     tags: [GeoJSON]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: top_n
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection
 *         content:
 *           application/json:
 *             examples:
 *               priorityGeoJson:
 *                 value:
 *                   type: "FeatureCollection"
 *                   features:
 *                     - type: "Feature"
 *                       geometry:
 *                         type: "Polygon"
 *                         coordinates: [[[126.978, 37.566], [126.988, 37.566], [126.988, 37.576], [126.978, 37.576], [126.978, 37.566]]]
 *                       properties:
 *                         rank: 1
 *                         unit_id: "11110515"
 *                         name: "청운효자동"
 *                         uci_score: 87.3
 *                         uci_grade: "E"
 *                         why_summary: "최근 4주 악취 민원 +38%, 야간 집중도 0.72"
 *                         key_drivers:
 *                           - signal: "complaint_odor_growth"
 *                             value: 0.83
 *                           - signal: "night_ratio"
 *                             value: 0.72
 */
router.get('/priority.geojson', async (req, res) => {
  try {
    const { date, top_n = 20 } = req.query;

    const comfortIndices = await ComfortIndex.find({ date })
      .sort({ uci_score: -1 })
      .limit(parseInt(top_n));

    const unitIds = comfortIndices.map(ci => ci.unit_id);
    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { unitsMap[u._id] = u; });

    const features = comfortIndices
      .filter(ci => unitsMap[ci.unit_id] && unitsMap[ci.unit_id].geom)
      .map((ci, index) => ({
        type: 'Feature',
        geometry: unitsMap[ci.unit_id].geom,
        properties: {
          rank: index + 1,
          unit_id: ci.unit_id,
          name: unitsMap[ci.unit_id].name || ci.unit_id,
          uci_score: ci.uci_score,
          uci_grade: ci.uci_grade,
          why_summary: ci.explain?.why_summary || '',
          key_drivers: ci.explain?.key_drivers || []
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

export default router;

