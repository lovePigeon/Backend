import express from 'express';
import Intervention from '../models/Intervention.js';
import ComfortIndex from '../models/ComfortIndex.js';
import mongoose from 'mongoose';
import { subDays, addDays, format } from 'date-fns';

const router = express.Router();

/**
 * @swagger
 * /api/v1/interventions:
 *   post:
 *     summary: Intervention 생성
 *     tags: [Interventions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unit_id
 *               - intervention_type
 *               - start_date
 *               - created_by
 *             properties:
 *               unit_id:
 *                 type: string
 *               intervention_type:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               note:
 *                 type: string
 *               created_by:
 *                 type: string
 *     responses:
 *       201:
 *         description: Intervention 생성 성공
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   _id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                   unit_id: "11110515"
 *                   intervention_type: "night_cleanup"
 *                   start_date: "2026-01-08"
 *                   end_date: null
 *                   note: "야간 집중 청소 실시"
 *                   created_by: "admin"
 *                   meta: {}
 *                   created_at: "2026-01-08T00:00:00.000Z"
 */
router.post('/', async (req, res) => {
  try {
    const intervention = new Intervention(req.body);
    await intervention.save();
    res.status(201).json(intervention);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Intervention 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/interventions:
 *   get:
 *     summary: Interventions 조회
 *     tags: [Interventions]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interventions 목록
 *         content:
 *           application/json:
 *             examples:
 *               interventions:
 *                 value:
 *                   - _id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                     unit_id: "11110515"
 *                     intervention_type: "night_cleanup"
 *                     start_date: "2026-01-08"
 *                     end_date: null
 *                     note: "야간 집중 청소 실시"
 *                     created_by: "admin"
 *                     created_at: "2026-01-08T00:00:00.000Z"
 */
router.get('/', async (req, res) => {
  try {
    const { unit_id } = req.query;
    const query = unit_id ? { unit_id } : {};
    
    const interventions = await Intervention.find(query).sort({ start_date: -1 }).limit(100);
    res.json(interventions);
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
 * /api/v1/interventions/{intervention_id}/tracking:
 *   get:
 *     summary: 개입 이력 및 전후 효과 조회
 *     tags: [Interventions]
 *     parameters:
 *       - in: path
 *         name: intervention_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: baseline_weeks
 *         schema:
 *           type: integer
 *           default: 4
 *       - in: query
 *         name: followup_weeks
 *         schema:
 *           type: integer
 *           default: 4
 *     responses:
 *       200:
 *         description: Tracking 데이터
 *         content:
 *           application/json:
 *             examples:
 *               tracking:
 *                 value:
 *                   intervention_id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                   unit_id: "11110515"
 *                   baseline_period:
 *                     - date: "2025-12-11"
 *                       uci_score: 82.5
 *                       components:
 *                         human_score: 0.75
 *                         geo_score: 0.60
 *                     - date: "2025-12-18"
 *                       uci_score: 80.3
 *                   followup_period:
 *                     - date: "2026-01-08"
 *                       uci_score: 75.2
 *                       components:
 *                         human_score: 0.68
 *                         geo_score: 0.55
 *                     - date: "2026-01-15"
 *                       uci_score: 72.1
 *                   intervention:
 *                     _id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                     unit_id: "11110515"
 *                     intervention_type: "night_cleanup"
 *                     start_date: "2026-01-08"
 */
router.get('/:intervention_id/tracking', async (req, res) => {
  try {
    const { intervention_id } = req.params;
    const { baseline_weeks = 4, followup_weeks = 4 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(intervention_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid intervention_id format'
      });
    }

    const intervention = await Intervention.findById(intervention_id);
    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervention not found'
      });
    }

    const startDate = new Date(intervention.start_date);
    const baselineStart = format(subDays(startDate, baseline_weeks * 7), 'yyyy-MM-dd');
    const baselineEnd = format(subDays(startDate, 1), 'yyyy-MM-dd');

    const followupStart = format(startDate, 'yyyy-MM-dd');
    const followupEnd = intervention.end_date
      ? format(new Date(intervention.end_date), 'yyyy-MM-dd')
      : format(addDays(startDate, followup_weeks * 7), 'yyyy-MM-dd');

    const baselineData = await ComfortIndex.find({
      unit_id: intervention.unit_id,
      date: { $gte: baselineStart, $lte: baselineEnd }
    }).sort({ date: 1 });

    const followupData = await ComfortIndex.find({
      unit_id: intervention.unit_id,
      date: { $gte: followupStart, $lte: followupEnd }
    }).sort({ date: 1 });

    const baselinePeriod = baselineData.map(d => ({
      date: d.date,
      uci_score: d.uci_score,
      components: d.components
    }));

    const followupPeriod = followupData.map(d => ({
      date: d.date,
      uci_score: d.uci_score,
      components: d.components
    }));

    res.json({
      intervention_id,
      unit_id: intervention.unit_id,
      baseline_period: baselinePeriod,
      followup_period: followupPeriod,
      intervention
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Tracking 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;

