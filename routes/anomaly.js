import express from 'express';
import AnomalySignal from '../models/AnomalySignal.js';
import { detectAnomaly } from '../services/anomalyDetection.js';
import SignalHuman from '../models/SignalHuman.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { format, parseISO } from 'date-fns';

const router = express.Router();

/**
 * @swagger
 * /api/v1/anomaly/compute:
 *   post:
 *     summary: AI 이상 탐지 실행
 *     tags: [Anomaly Detection]
 *     description: 모든 지역 또는 특정 지역에 대해 AI 이상 탐지를 실행하고 결과를 저장합니다.
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
 *                 description: 계산 기준 날짜 (YYYY-MM-DD). 생략 시 최신 데이터 날짜 사용.
 *               unit_id:
 *                 type: string
 *                 description: 특정 unit_id만 계산. 생략 시 모든 unit_id 계산.
 *           examples:
 *             allUnits:
 *               value:
 *                 date: "2025-12-01"
 *             singleUnit:
 *               value:
 *                 date: "2025-12-01"
 *                 unit_id: "11110"
 *     responses:
 *       200:
 *         description: 이상 탐지 완료
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   message: "이상 탐지 완료"
 *                   date: "2025-12-01"
 *                   total: 48
 *                   success_count: 45
 *                   failed_count: 3
 *                   anomaly_count: 12
 *                   results:
 *                     - unit_id: "11110"
 *                       anomaly_score: 0.85
 *                       anomaly_flag: true
 *                       status: "success"
 */
router.post('/compute', async (req, res) => {
  try {
    const { date, unit_id } = req.body;

    let targetDate = date ? parseISO(date) : null;
    let dateStr = date ? format(parseISO(date), 'yyyy-MM-dd') : null;

    if (!dateStr) {
      const latestSignal = await SignalHuman.findOne({ signal_type: 'total' }).sort({ date: -1 });
      if (latestSignal) {
        dateStr = latestSignal.date;
        targetDate = parseISO(dateStr);
      } else {
        dateStr = format(new Date(), 'yyyy-MM-dd');
        targetDate = new Date();
      }
    }

    let unitsToProcess = [];
    if (unit_id) {
      unitsToProcess.push(unit_id);
    } else {
      const spatialUnits = await SpatialUnit.find({});
      const districtUnits = await SignalHuman.distinct('unit_id', { 'meta.source': 'seoul_district_complaints' });
      const allUnitIds = new Set();
      spatialUnits.forEach(unit => allUnitIds.add(unit._id));
      districtUnits.forEach(id => allUnitIds.add(id));
      unitsToProcess = Array.from(allUnitIds);
    }

    const resultsSummary = [];
    let successCount = 0;
    let failedCount = 0;
    let anomalyCount = 0;

    for (const currentUnitId of unitsToProcess) {
      try {
        const result = await detectAnomaly(currentUnitId, dateStr, 4, 8);
        
        await AnomalySignal.findOneAndUpdate(
          { unit_id: result.unit_id, date: result.date },
          {
            unit_id: result.unit_id,
            date: result.date,
            anomaly_score: result.anomaly_score,
            anomaly_flag: result.anomaly_flag,
            features: result.features,
            stats: result.stats,
            explanation: result.explanation,
            created_at: new Date()
          },
          { upsert: true, new: true }
        );

        if (result.anomaly_flag) {
          anomalyCount++;
        }

        resultsSummary.push({
          unit_id: currentUnitId,
          anomaly_score: result.anomaly_score,
          anomaly_flag: result.anomaly_flag,
          status: 'success'
        });
        successCount++;
      } catch (unitError) {
        console.error(`Error detecting anomaly for unit ${currentUnitId}:`, unitError);
        resultsSummary.push({
          unit_id: currentUnitId,
          status: 'failed',
          reason: unitError.message
        });
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: '이상 탐지 완료',
      date: dateStr,
      total: unitsToProcess.length,
      success_count: successCount,
      failed_count: failedCount,
      anomaly_count: anomalyCount,
      results: resultsSummary
    });
  } catch (error) {
    console.error('Error in /anomaly/compute:', error);
    res.status(500).json({
      success: false,
      message: '이상 탐지 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/anomaly:
 *   get:
 *     summary: 이상 탐지 결과 조회
 *     tags: [Anomaly Detection]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (YYYY-MM-DD). 생략 시 최신 날짜 사용.
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *         description: 특정 지역만 조회
 *       - in: query
 *         name: anomaly_flag
 *         schema:
 *           type: boolean
 *         description: 이상 탐지된 것만 조회 (true/false)
 *     responses:
 *       200:
 *         description: 이상 탐지 결과 목록
 *         content:
 *           application/json:
 *             examples:
 *               anomalies:
 *                 value:
 *                   - unit_id: "11110"
 *                     date: "2025-12-01"
 *                     anomaly_score: 0.85
 *                     anomaly_flag: true
 *                     explanation: "최근 4주 민원이 45% 증가, 통계적 이상치 감지 (Z-score: 3.2) - 급격한 악화 신호"
 *                     features:
 *                       complaint_change_4w: 0.45
 *                       complaint_growth_rate: 0.32
 *                     stats:
 *                       z_score: 3.2
 */
router.get('/', async (req, res) => {
  try {
    const { date, unit_id, anomaly_flag } = req.query;

    let query = {};
    
    if (unit_id) {
      query.unit_id = unit_id;
    }

    if (date) {
      query.date = date;
    } else {
      const latest = await AnomalySignal.findOne().sort({ date: -1 });
      if (latest) {
        query.date = latest.date;
      }
    }

    if (anomaly_flag !== undefined) {
      query.anomaly_flag = anomaly_flag === 'true';
    }

    const results = await AnomalySignal.find(query)
      .sort({ anomaly_score: -1 })
      .lean();

    res.json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '이상 탐지 결과 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/anomaly/{unit_id}:
 *   get:
 *     summary: 특정 지역의 이상 탐지 결과 조회
 *     tags: [Anomaly Detection]
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
 *         description: 이상 탐지 결과
 *       404:
 *         description: 이상 탐지 결과를 찾을 수 없음
 */
router.get('/:unit_id', async (req, res) => {
  try {
    const { unit_id } = req.params;
    const { date } = req.query;

    const query = { unit_id };
    if (date) {
      query.date = date;
    }

    const result = await AnomalySignal.findOne(query).sort({ date: -1 }).lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Anomaly signal not found'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '이상 탐지 결과 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;

