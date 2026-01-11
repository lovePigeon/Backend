import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import AnomalySignal from '../models/AnomalySignal.js';
import { computeUCIForUnit } from '../services/uciCompute.js';
import { settings } from '../config/settings.js';

const router = express.Router();

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

    let query = {};
    
    // 날짜가 없으면 최신 날짜 사용
    if (date) {
      query.date = date;
    } else {
      const latest = await ComfortIndex.findOne().sort({ date: -1 });
      if (latest) {
        query.date = latest.date;
      }
    }

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

    // AI 이상 탐지 정보 추가
    const anomalySignal = await AnomalySignal.findOne({
      unit_id,
      date: result.date
    }).lean();

    const response = result.toObject ? result.toObject() : result;
    if (anomalySignal) {
      response.anomaly = {
        anomaly_score: anomalySignal.anomaly_score,
        anomaly_flag: anomalySignal.anomaly_flag,
        explanation: anomalySignal.explanation
      };
    }

    res.json(response);
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
 * /api/v1/comfort-index/compute:
 *   post:
 *     summary: UCI 계산 및 저장
 *     tags: [Comfort Index]
 *     description: 특정 지역 또는 모든 지역에 대해 Urban Comfort Index를 계산하고 저장합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: 계산할 날짜 (YYYY-MM-DD, 없으면 오늘)
 *               unit_id:
 *                 type: string
 *                 description: 특정 지역만 계산 (없으면 모든 지역)
 *               window_weeks:
 *                 type: integer
 *                 default: 4
 *                 description: 집계 기간 (주)
 *               use_pigeon:
 *                 type: boolean
 *                 default: false
 *                 description: 비둘기 신호 사용 여부
 *           examples:
 *             singleUnit:
 *               value:
 *                 date: "2025-12-01"
 *                 unit_id: "11110515"
 *                 window_weeks: 4
 *                 use_pigeon: false
 *             allUnits:
 *               value:
 *                 date: "2025-12-01"
 *                 window_weeks: 4
 *                 use_pigeon: false
 *     responses:
 *       200:
 *         description: UCI 계산 완료
 *         content:
 *           application/json:
 *             examples:
 *               computeResult:
 *                 value:
 *                   success: true
 *                   message: "UCI 계산 완료"
 *                   date: "2025-12-01"
 *                   computed_count: 48
 *                   failed_count: 0
 *                   results:
 *                     - unit_id: "11110515"
 *                       uci_score: 63.14
 *                       uci_grade: "D"
 *                       status: "success"
 */
router.post('/compute', async (req, res) => {
  try {
    const { date, unit_id, window_weeks = settings.defaultWindowWeeks, use_pigeon = false } = req.body;
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    const results = [];
    let successCount = 0;
    let failCount = 0;

    if (unit_id) {
      // 특정 지역만 계산
      const result = await computeUCIForUnit(unit_id, targetDate, window_weeks, use_pigeon);
      
      if (result) {
        // MongoDB에 저장 (upsert)
        await ComfortIndex.findOneAndUpdate(
          { unit_id, date: result.date },
          result,
          { upsert: true, new: true }
        );
        
        results.push({
          unit_id: result.unit_id,
          uci_score: result.uci_score,
          uci_grade: result.uci_grade,
          status: 'success'
        });
        successCount = 1;
      } else {
        results.push({
          unit_id,
          status: 'failed',
          error: '데이터 부족으로 계산 불가'
        });
        failCount = 1;
      }
    } else {
      // 모든 지역 계산
      const units = await SpatialUnit.find({}).select('_id').lean();
      const unitIds = units.map(u => u._id);

      for (const uid of unitIds) {
        try {
          const result = await computeUCIForUnit(uid, targetDate, window_weeks, use_pigeon);
          
          if (result) {
            // MongoDB에 저장 (upsert)
            await ComfortIndex.findOneAndUpdate(
              { unit_id: result.unit_id, date: result.date },
              result,
              { upsert: true, new: true }
            );
            
            results.push({
              unit_id: result.unit_id,
              uci_score: result.uci_score,
              uci_grade: result.uci_grade,
              status: 'success'
            });
            successCount++;
          } else {
            results.push({
              unit_id: uid,
              status: 'failed',
              error: '데이터 부족으로 계산 불가'
            });
            failCount++;
          }
        } catch (error) {
          results.push({
            unit_id: uid,
            status: 'failed',
            error: error.message
          });
          failCount++;
        }
      }
    }

    res.json({
      success: true,
      message: 'UCI 계산 완료',
      date: targetDate,
      computed_count: successCount,
      failed_count: failCount,
      total_count: results.length,
      results: results.slice(0, 10) // 처음 10개만 반환 (전체는 너무 클 수 있음)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'UCI 계산 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
