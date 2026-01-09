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

    // 날짜가 없거나 해당 날짜에 데이터가 없으면 최신 날짜 사용
    let targetDate = date;
    let comfortIndices = [];

    // 요청된 날짜로 먼저 조회
    if (targetDate) {
      comfortIndices = await ComfortIndex.find({ date: targetDate })
        .sort({ uci_score: -1 })
        .limit(parseInt(top_n));
    }

    // 해당 날짜에 데이터가 없으면 최신 날짜 조회
    if (!targetDate || comfortIndices.length === 0) {
      const latestComfortIndex = await ComfortIndex.findOne()
        .sort({ date: -1 });
      
      if (latestComfortIndex) {
        targetDate = latestComfortIndex.date;
        comfortIndices = await ComfortIndex.find({ date: targetDate })
          .sort({ uci_score: -1 })
          .limit(parseInt(top_n));
      }
    }

    // 데이터가 없으면 빈 배열 반환
    if (comfortIndices.length === 0) {
      console.log(`[Priority Queue] No data found. Requested date: ${date}, Target date: ${targetDate}`);
      return res.json([]);
    }

    console.log(`[Priority Queue] Found ${comfortIndices.length} items for date: ${targetDate}`);

    // unit_id 추출 및 units 조회
    const unitIds = comfortIndices.map(ci => ci.unit_id).filter(id => id); // null/undefined 제거
    
    if (unitIds.length === 0) {
      return res.json([]);
    }

    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { 
      unitsMap[u._id] = u.name; 
    });

    // items 생성 (unit이 없어도 unit_id로 표시)
    const items = comfortIndices
      .filter(ci => ci.unit_id) // unit_id가 있는 것만
      .map((ci, index) => ({
        rank: index + 1,
        unit_id: ci.unit_id,
        name: unitsMap[ci.unit_id] || ci.unit_id,
        uci_score: ci.uci_score,
        uci_grade: ci.uci_grade,
        why_summary: ci.explain?.why_summary || '',
        key_drivers: ci.explain?.key_drivers || []
      }));

    // items가 비어있으면 빈 배열 반환
    if (items.length === 0) {
      console.log(`[Priority Queue] Items array is empty after processing. comfortIndices: ${comfortIndices.length}, units: ${units.length}`);
      return res.json([]);
    }

    console.log(`[Priority Queue] Returning ${items.length} items`);
    res.json(items);
  } catch (error) {
    console.error('Priority queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Priority queue 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
