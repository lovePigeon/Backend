import express from 'express';
import SpatialUnit from '../models/SpatialUnit.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/units:
 *   get:
 *     summary: Spatial units 조회
 *     tags: [Units]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 검색어 (이름)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: 최대 조회 개수
 *     responses:
 *       200:
 *         description: Spatial units 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *             examples:
 *               units:
 *                 value:
 *                   - _id: "11110515"
 *                     name: "청운효자동"
 *                     geom:
 *                       type: "Polygon"
 *                       coordinates: [[[126.978, 37.566], [126.988, 37.566], [126.988, 37.576], [126.978, 37.576], [126.978, 37.566]]]
 *                     meta: {}
 */
router.get('/', async (req, res) => {
  try {
    const { q, limit = 100 } = req.query;
    
    const query = {};
    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }

    const units = await SpatialUnit.find(query).limit(parseInt(limit));
    res.json(units);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/units/{unit_id}:
 *   get:
 *     summary: 특정 unit 조회
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 *     responses:
 *       200:
 *         description: Unit 정보
 *         content:
 *           application/json:
 *             examples:
 *               unit:
 *                 value:
 *                   _id: "11110515"
 *                   name: "청운효자동"
 *                   geom:
 *                     type: "Polygon"
 *                     coordinates: [[[126.978, 37.566], [126.988, 37.566], [126.988, 37.576], [126.978, 37.576], [126.978, 37.566]]]
 *                   meta: {}
 *       404:
 *         description: Unit을 찾을 수 없음
 *         content:
 *           application/json:
 *             examples:
 *               notFound:
 *                 value:
 *                   success: false
 *                   message: "Unit not found"
 */
router.get('/:unit_id', async (req, res) => {
  try {
    const unit = await SpatialUnit.findById(req.params.unit_id);
    
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Unit not found'
      });
    }

    res.json(unit);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/units/within/geo:
 *   get:
 *     summary: 반경 내 units 조회 (GeoJSON)
 *     tags: [Units]
 *     parameters:
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: 경도
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: 위도
 *       - in: query
 *         name: radius_m
 *         schema:
 *           type: number
 *           default: 1000
 *         description: 반경 (미터)
 *     responses:
 *       200:
 *         description: 반경 내 units 목록
 *         content:
 *           application/json:
 *             examples:
 *               nearby:
 *                 value:
 *                   - _id: "11110515"
 *                     name: "청운효자동"
 *                     geom:
 *                       type: "Polygon"
 *                       coordinates: [[[126.978, 37.566], [126.988, 37.566], [126.988, 37.576], [126.978, 37.576], [126.978, 37.566]]]
 */
router.get('/within/geo', async (req, res) => {
  try {
    const { lng, lat, radius_m = 1000 } = req.query;
    
    const point = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };

    const radiusRadians = parseFloat(radius_m) / 6378100; // 미터를 라디안으로

    const units = await SpatialUnit.find({
      geom: {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusRadians]
        }
      }
    });

    res.json(units);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/units:
 *   post:
 *     summary: Spatial unit 생성
 *     tags: [Units]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unit_id
 *               - name
 *               - geom
 *             properties:
 *               unit_id:
 *                 type: string
 *               name:
 *                 type: string
 *               geom:
 *                 type: object
 *     responses:
 *       201:
 *         description: Unit 생성 성공
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   _id: "11110515"
 *                   name: "청운효자동"
 *                   geom:
 *                     type: "Polygon"
 *                     coordinates: [[[126.978, 37.566], [126.988, 37.566], [126.988, 37.576], [126.978, 37.576], [126.978, 37.566]]]
 *                   meta: {}
 */
router.post('/', async (req, res) => {
  try {
    const unit = new SpatialUnit({
      _id: req.body.unit_id,
      name: req.body.name,
      geom: req.body.geom,
      meta: req.body.meta || {}
    });

    await unit.save();
    res.status(201).json(unit);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '데이터 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
