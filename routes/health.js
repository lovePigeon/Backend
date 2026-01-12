import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: 서버 및 데이터베이스 연결 상태를 확인합니다.
 *     responses:
 *       200:
 *         description: 서버가 정상 작동 중입니다
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 database:
 *                   type: string
 *                   example: connected
 *             examples:
 *               success:
 *                 value:
 *                   status: healthy
 *                   database: connected
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             examples:
 *               error:
 *                 value:
 *                   status: unhealthy
 *                   database: disconnected
 *                   error: Connection timeout
 */
router.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'healthy',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

export default router;

