import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { connectDB } from './config/database.js';
import { validateEnv } from './config/env.js';
import healthRoutes from './routes/health.js';
import comfortIndexRoutes from './routes/comfortIndex.js';
import priorityRoutes from './routes/priority.js';
import actionCardsRoutes from './routes/actionCards.js';
import geoRoutes from './routes/geo.js';
import dataRoutes from './routes/data.js';
import dataImportRoutes from './routes/dataImport.js';
import dashboardRoutes from './routes/dashboard.js';
import interventionsRoutes from './routes/interventions.js';
import uciInfoRoutes from './routes/uciInfo.js';
import anomalyRoutes from './routes/anomaly.js';
import analyticsRoutes from './routes/analytics.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

// 환경 변수 검증
try {
  validateEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '민원냠냠 API 문서'
}));

// MongoDB 연결
connectDB();

// 라우트 (프론트엔드 핵심 엔드포인트만)
app.use('/api/v1', healthRoutes);
app.use('/api/v1/comfort-index', comfortIndexRoutes);
app.use('/api/v1/priority-queue', priorityRoutes);
app.use('/api/v1/action-cards', actionCardsRoutes);
app.use('/api/v1/geo', geoRoutes);
app.use('/api/v1/data', dataRoutes);
app.use('/api/v1/data', dataImportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/interventions', interventionsRoutes); // POST로 조치 등록
app.use('/api/v1/uci-info', uciInfoRoutes); // UCI 계산 로직 설명
app.use('/api/v1/anomaly', anomalyRoutes); // AI 이상 탐지
app.use('/api/v1/analytics', analyticsRoutes); // 시계열 분석 및 데이터 보강

// 루트
/**
 * @swagger
 * /:
 *   get:
 *     summary: API 루트 엔드포인트
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API 정보
 */
app.get('/', (req, res) => {
  res.json({
    message: '민원냠냠 Core Engine API',
    version: '1.0.0',
    docs: '/docs',
    endpoints: {
      dashboard: '/api/v1/dashboard',
      data: '/api/v1/data',
      comfort_index: '/api/v1/comfort-index',
      priority_queue: '/api/v1/priority-queue',
      action_cards: '/api/v1/action-cards',
      geo: '/api/v1/geo',
      uci_info: '/api/v1/uci-info',
      anomaly: '/api/v1/anomaly',
      analytics: '/api/v1/analytics'
    }
  });
});

// 에러 핸들링 (모든 라우트 다음에 배치)
app.use(errorHandler);

// 404 핸들러 (모든 라우트 다음에 배치)
app.use(notFoundHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API: http://localhost:${PORT}`);
});

export default app;

