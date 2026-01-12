import express from 'express';
import Intervention from '../models/Intervention.js';
import { validate, endpointSchemas } from '../middleware/validate.js';

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
router.post('/', validate(endpointSchemas.createIntervention, 'body'), async (req, res) => {
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

// GET /interventions와 GET /interventions/{id}/tracking은 
// dashboard/interventions와 dashboard/interventions/{id}/effect로 대체됨
// 더 많은 정보를 제공하므로 dashboard 버전 사용 권장

export default router;

