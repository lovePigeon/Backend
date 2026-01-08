import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { computeUCIForUnit } from '../services/uciCompute.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/comfort-index/compute:
 *   post:
 *     summary: UCI 계산 및 저장
 *     tags: [Comfort Index]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-08"
 *               window_weeks:
 *                 type: integer
 *                 default: 4
 *               use_pigeon:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: UCI 계산 완료
 *         content:
 *           application/json:
 *             examples:
 *               computeResult:
 *                 value:
 *                   success: 50
 *                   errors: 0
 *                   results:
 *                     - unit_id: "11110515"
 *                       uci_score: 78.2
 *                       uci_grade: "D"
 *                     - unit_id: "11110516"
 *                       uci_score: 65.5
 *                       uci_grade: "C"
 *                   error_details: []
 */
router.post('/compute', async (req, res) => {
  try {
    const { date, window_weeks = 4, use_pigeon = false } = req.body;

    const units = await SpatialUnit.find({});
    const results = [];
    const errors = [];

    for (const unit of units) {
      try {
        const uciResult = await computeUCIForUnit(
          unit._id,
          date,
          window_weeks,
          use_pigeon
        );

        if (uciResult) {
          await ComfortIndex.findOneAndUpdate(
            { unit_id: unit._id, date },
            uciResult,
            { upsert: true, new: true }
          );

          results.push({
            unit_id: unit._id,
            uci_score: uciResult.uci_score,
            uci_grade: uciResult.uci_grade
          });
        }
      } catch (error) {
        errors.push({
          unit_id: unit._id,
          error: error.message
        });
      }
    }

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      error_details: errors.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'UCI 계산 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/comfort-index:
 *   get:
 *     summary: Comfort index 조회
 *     tags: [Comfort Index]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *           enum: [A, B, C, D, E]
 *         description: 등급 필터
 *       - in: query
 *         name: top_k
 *         schema:
 *           type: integer
 *         description: 상위 K개만
 *     responses:
 *       200:
 *         description: Comfort index 목록
 *         content:
 *           application/json:
 *             examples:
 *               indices:
 *                 value:
 *                   - unit_id: "11110515"
 *                     date: "2026-01-08"
 *                     uci_score: 78.2
 *                     uci_grade: "D"
 *                     components:
 *                       human_score: 0.65
 *                       geo_score: 0.55
 *                       population_score: 0.45
 *                     explain:
 *                       why_summary: "최근 4주 악취 민원 +38%, 야간 집중도 0.72"
 *                       key_drivers:
 *                         - signal: "complaint_odor_growth"
 *                           value: 0.83
 *                         - signal: "night_ratio"
 *                           value: 0.72
 */
router.get('/', async (req, res) => {
  try {
    const { date, grade, top_k } = req.query;

    const query = { date };
    if (grade) {
      query.uci_grade = grade;
    }

    let queryResult = ComfortIndex.find(query).sort({ uci_score: -1 });
    if (top_k) {
      queryResult = queryResult.limit(parseInt(top_k));
    }

    const results = await queryResult;
    res.json(results);
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
 * /api/v1/comfort-index/{unit_id}:
 *   get:
 *     summary: 특정 unit의 comfort index 조회
 *     tags: [Comfort Index]
 *     parameters:
 *       - in: path
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (없으면 최신)
 *     responses:
 *       200:
 *         description: Comfort index
 *         content:
 *           application/json:
 *             examples:
 *               index:
 *                 value:
 *                   unit_id: "11110515"
 *                   date: "2026-01-08"
 *                   uci_score: 78.2
 *                   uci_grade: "D"
 *                   components:
 *                     human_score: 0.65
 *                     geo_score: 0.55
 *                     population_score: 0.45
 *                     human_normalized:
 *                       total_complaints: 0.8
 *                       night_ratio: 0.72
 *                       repeat_ratio: 0.55
 *                   explain:
 *                     why_summary: "최근 4주 악취 민원 +38%, 야간 집중도 0.72"
 *                     key_drivers:
 *                       - signal: "complaint_odor_growth"
 *                         value: 0.83
 *       404:
 *         description: Comfort index를 찾을 수 없음
 */
router.get('/:unit_id', async (req, res) => {
  try {
    const { unit_id } = req.params;
    const { date } = req.query;

    const query = { unit_id };
    if (date) {
      query.date = date;
    }

    const result = await ComfortIndex.findOne(query).sort({ date: -1 });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Comfort index not found'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
