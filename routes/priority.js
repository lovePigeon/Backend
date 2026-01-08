import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/priority-queue:
 *   get:
 *     summary: Priority Queue 조회 (UCI 점수 높은 순)
 *     tags: [Priority Queue]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: top_n
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 상위 N개
 *     responses:
 *       200:
 *         description: Priority queue 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   rank:
 *                     type: integer
 *                   unit_id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   uci_score:
 *                     type: number
 *                   uci_grade:
 *                     type: string
 *                   why_summary:
 *                     type: string
 *                   key_drivers:
 *                     type: array
 *             examples:
 *               priorityQueue:
 *                 value:
 *                   - rank: 1
 *                     unit_id: "11110515"
 *                     name: "청운효자동"
 *                     uci_score: 87.3
 *                     uci_grade: "E"
 *                     why_summary: "최근 4주 악취 민원 +38%, 야간 집중도 0.72, 골목 밀도 상위 10%"
 *                     key_drivers:
 *                       - signal: "complaint_odor_growth"
 *                         value: 0.83
 *                       - signal: "night_ratio"
 *                         value: 0.72
 *                       - signal: "alley_density"
 *                         value: 0.91
 *                   - rank: 2
 *                     unit_id: "11110516"
 *                     name: "효자동"
 *                     uci_score: 75.5
 *                     uci_grade: "D"
 *                     why_summary: "야간 쓰레기 민원 증가 및 동일 지역 반복 신고"
 *                     key_drivers:
 *                       - signal: "night_ratio"
 *                         value: 0.68
 *                       - signal: "repeat_ratio"
 *                         value: 0.62
 */
router.get('/', async (req, res) => {
  try {
    const { date, top_n = 20 } = req.query;

    const comfortIndices = await ComfortIndex.find({ date })
      .sort({ uci_score: -1 })
      .limit(parseInt(top_n));

    const unitIds = comfortIndices.map(ci => ci.unit_id);
    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { unitsMap[u._id] = u.name; });

    const items = comfortIndices.map((ci, index) => ({
      rank: index + 1,
      unit_id: ci.unit_id,
      name: unitsMap[ci.unit_id] || ci.unit_id,
      uci_score: ci.uci_score,
      uci_grade: ci.uci_grade,
      why_summary: ci.explain?.why_summary || '',
      key_drivers: ci.explain?.key_drivers || []
    }));

    res.json(items);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Priority queue 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
