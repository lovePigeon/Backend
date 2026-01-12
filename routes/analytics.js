import express from 'express';
import { analyzeUCITrend, analyzeComplaintTrend } from '../services/timeSeriesAnalysis.js';
import { generateDataQualityReport, generateBaselineBasedData } from '../services/dataAugmentation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SignalHuman from '../models/SignalHuman.js';
import { validate, endpointSchemas } from '../middleware/validate.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/analytics/trend:
 *   get:
 *     summary: UCI 트렌드 분석 및 예측
 *     tags: [Analytics]
 *     description: 시계열 분석을 통한 UCI 트렌드 및 7일 예측
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 분석 기간 (일)
 *       - in: query
 *         name: forecast_days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 예측 기간 (일)
 *     responses:
 *       200:
 *         description: 트렌드 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               trend:
 *                 value:
 *                   unit_id: "11110"
 *                   hasData: true
 *                   current:
 *                     uci_score: 63.14
 *                     uci_grade: "D"
 *                   trend:
 *                     direction: "increasing"
 *                     slope: 0.5
 *                     change_rate: "12.5"
 *                     confidence: 0.85
 *                   forecast:
 *                     - date: "2025-12-08"
 *                       value: 65.2
 *                       confidence: 0.9
 */
router.get('/trend', validate(endpointSchemas.analyticsTrend, 'query'), async (req, res) => {
  try {
    const { unit_id, days = 30, forecast_days = 7 } = req.query;

    if (!unit_id) {
      return res.status(400).json({
        success: false,
        message: 'unit_id is required'
      });
    }

    const result = await analyzeUCITrend(unit_id, parseInt(days), parseInt(forecast_days));
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '트렌드 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/complaint-trend:
 *   get:
 *     summary: 민원 트렌드 분석
 *     tags: [Analytics]
 *     description: 시계열 분석을 통한 민원 트렌드 및 예측
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 지역 ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 분석 기간 (일)
 *       - in: query
 *         name: forecast_days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 예측 기간 (일)
 *     responses:
 *       200:
 *         description: 민원 트렌드 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               complaintTrend:
 *                 value:
 *                   unit_id: "11110"
 *                   hasData: true
 *                   current:
 *                     total_complaints: 25
 *                   trend:
 *                     direction: "increasing"
 *                     slope: 0.3
 *                     confidence: 0.75
 *                   forecast:
 *                     - date: "2025-12-08"
 *                       value: 28
 *                       confidence: 0.8
 *                   seasonality:
 *                     dayOfWeek: {}
 *                     monthly: {}
 *       400:
 *         description: 필수 파라미터 누락
 *       500:
 *         description: 서버 오류
 */
router.get('/complaint-trend', async (req, res) => {
  try {
    const { unit_id, days = 30, forecast_days = 7 } = req.query;

    if (!unit_id) {
      return res.status(400).json({
        success: false,
        message: 'unit_id is required'
      });
    }

    const result = await analyzeComplaintTrend(unit_id, parseInt(days), parseInt(forecast_days));
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '민원 트렌드 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/data-quality:
 *   get:
 *     summary: 데이터 품질 리포트
 *     tags: [Analytics]
 *     description: 데이터 완전성, 결측치, 이상치 분석
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *         description: 특정 지역만 조회 (선택)
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 데이터 품질 리포트
 *         content:
 *           application/json:
 *             examples:
 *               dataQuality:
 *                 value:
 *                   success: true
 *                   report_date: "2026-01-08"
 *                   unit_id: "11110"
 *                   date_range:
 *                     start: "2025-11-01"
 *                     end: "2025-12-01"
 *                   completeness_score: 87.33
 *                   missing_data_points: 5
 *                   outliers_detected: 12
 *                   quality_score: 87.33
 *                   details:
 *                     human_signals:
 *                       completeness: 83.33
 *                       missing_days: 5
 *                     population_signals:
 *                       completeness: 93.33
 *                       missing_days: 2
 */
router.get('/data-quality', async (req, res) => {
  try {
    const { unit_id, start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date and end_date are required'
      });
    }

    const report = await generateDataQualityReport(unit_id || null, start_date, end_date);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 품질 리포트 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/augment:
 *   post:
 *     summary: 데이터 보강 (결측치 채우기)
 *     tags: [Analytics]
 *     description: 베이스라인 기반으로 결측 데이터 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unit_id
 *               - start_date
 *               - end_date
 *             properties:
 *               unit_id:
 *                 type: string
 *                 description: 지역 ID
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: 시작 날짜 (YYYY-MM-DD)
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: 종료 날짜 (YYYY-MM-DD)
 *               signal_type:
 *                 type: string
 *                 enum: [human, population]
 *                 default: human
 *                 description: 신호 타입
 *           examples:
 *             augmentHuman:
 *               value:
 *                 unit_id: "11110"
 *                 start_date: "2025-11-01"
 *                 end_date: "2025-12-01"
 *                 signal_type: "human"
 *     responses:
 *       200:
 *         description: 보강된 데이터
 *         content:
 *           application/json:
 *             examples:
 *               augmentResult:
 *                 value:
 *                   success: true
 *                   generated_count: 10
 *                   data:
 *                     - date: "2025-11-05"
 *                       unit_id: "11110"
 *                       signal_type: "total"
 *                       value: 15
 *                       meta:
 *                         generated: true
 *                         confidence: 0.6
 *                   note: "이 데이터는 통계적 방법으로 생성되었으며 실제 데이터가 아닙니다."
 */
router.post('/augment', validate(endpointSchemas.augmentData, 'body'), async (req, res) => {
  try {
    const { unit_id, start_date, end_date, signal_type = 'human' } = req.body;

    if (!unit_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'unit_id, start_date, and end_date are required'
      });
    }

    const generated = await generateBaselineBasedData(unit_id, start_date, end_date, signal_type);
    
    res.json({
      success: true,
      generated_count: generated.length,
      data: generated,
      note: '이 데이터는 통계적 방법으로 생성되었으며 실제 데이터가 아닙니다.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 보강 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
