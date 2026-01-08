/**
 * Swagger 주석을 모든 라우트에 추가하기 위한 참고 파일
 * 각 라우트 파일에 이 주석들을 복사해서 사용하세요
 */

// Action Cards 예시
/**
 * @swagger
 * /api/v1/action-cards/generate:
 *   post:
 *     summary: Action Cards 생성
 *     tags: [Action Cards]
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
 *               unit_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               use_pigeon:
 *                 type: boolean
 */

// Interventions 예시
/**
 * @swagger
 * /api/v1/interventions:
 *   post:
 *     summary: Intervention 생성
 *     tags: [Interventions]
 *   get:
 *     summary: Interventions 조회
 *     tags: [Interventions]
 */

// Dashboard 예시
/**
 * @swagger
 * /api/v1/dashboard/summary:
 *   get:
 *     summary: 데이터 요약 조회
 *     tags: [Dashboard]
 * /api/v1/dashboard/human-signal:
 *   get:
 *     summary: 민원 데이터 조회
 *     tags: [Dashboard]
 * /api/v1/dashboard/geo-signal:
 *   get:
 *     summary: 지리 공간 데이터 조회
 *     tags: [Dashboard]
 * /api/v1/dashboard/population-signal:
 *   get:
 *     summary: 생활인구 데이터 조회
 *     tags: [Dashboard]
 * /api/v1/dashboard/uci:
 *   get:
 *     summary: 편의성 지수 조회
 *     tags: [Dashboard]
 */

// Data 예시
/**
 * @swagger
 * /api/v1/data/upload:
 *   post:
 *     summary: CSV 파일 업로드
 *     tags: [Data]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 * /api/v1/data/import/{type}:
 *   post:
 *     summary: CSV 데이터 임포트
 *     tags: [Data]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, geo, population, spatial_units]
 */

// GeoJSON 예시
/**
 * @swagger
 * /api/v1/geo/comfort-index.geojson:
 *   get:
 *     summary: Comfort Index GeoJSON
 *     tags: [GeoJSON]
 * /api/v1/geo/priority.geojson:
 *   get:
 *     summary: Priority Queue GeoJSON
 *     tags: [GeoJSON]
 */

