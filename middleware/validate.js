/**
 * Request Validation Middleware
 * 
 * Joi를 사용한 입력 데이터 검증
 */

import Joi from 'joi';

/**
 * Joi 스키마 검증 미들웨어 생성
 * @param {Object} schema - Joi 스키마
 * @param {string} property - 검증할 요청 속성 ('body', 'query', 'params')
 * @returns {Function} Express 미들웨어
 */
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req[property] = value;
    next();
  };
}

/**
 * 공통 검증 스키마
 */
export const schemas = {
  // 날짜 형식 (YYYY-MM-DD)
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({
      'string.pattern.base': 'date must be in YYYY-MM-DD format'
    }),

  // 선택적 날짜
  optionalDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      'string.pattern.base': 'date must be in YYYY-MM-DD format'
    }),

  // unit_id
  unitId: Joi.string().required(),

  // 선택적 unit_id
  optionalUnitId: Joi.string(),

  // window_weeks
  windowWeeks: Joi.number().integer().min(1).max(12).default(4).optional(),

  // top_n / top_k
  topN: Joi.number().integer().min(1).max(100).default(20).optional(),

  // forecast_days
  forecastDays: Joi.number().integer().min(1).max(30).default(7),

  // period
  period: Joi.string().valid('day', 'week', 'month', 'quarter').default('day'),

  // grade
  grade: Joi.string().valid('A', 'B', 'C', 'D', 'E'),

  // boolean
  boolean: Joi.boolean().default(false),

  // anomaly_flag
  anomalyFlag: Joi.string().valid('true', 'false')
};

/**
 * 엔드포인트별 검증 스키마
 */
export const endpointSchemas = {
  // POST /api/v1/comfort-index/compute
  computeUCI: Joi.object({
    date: schemas.optionalDate,
    unit_id: schemas.optionalUnitId,
    window_weeks: schemas.windowWeeks,
    use_pigeon: schemas.boolean
  }),

  // GET /api/v1/comfort-index
  getComfortIndex: Joi.object({
    date: schemas.optionalDate,
    grade: schemas.grade,
    top_k: schemas.topN
  }),

  // GET /api/v1/priority-queue
  getPriorityQueue: Joi.object({
    date: schemas.optionalDate,
    top_n: schemas.topN.optional()
  }),

  // POST /api/v1/anomaly/compute
  computeAnomaly: Joi.object({
    date: schemas.optionalDate,
    unit_id: schemas.optionalUnitId
  }),

  // GET /api/v1/anomaly
  getAnomaly: Joi.object({
    date: schemas.optionalDate,
    unit_id: schemas.optionalUnitId,
    anomaly_flag: schemas.anomalyFlag
  }),

  // GET /api/v1/analytics/trend
  analyticsTrend: Joi.object({
    unit_id: schemas.unitId,
    days: Joi.number().integer().min(1).max(365).default(30),
    forecast_days: schemas.forecastDays
  }),

  // GET /api/v1/dashboard/trends
  dashboardTrends: Joi.object({
    period: Joi.string().valid('week', 'month', 'quarter').default('quarter')
  }),

  // GET /api/v1/dashboard/human-signal
  dashboardHumanSignal: Joi.object({
    date: schemas.optionalDate,
    unit_id: schemas.optionalUnitId,
    period: schemas.period
  }),

  // POST /api/v1/interventions
  createIntervention: Joi.object({
    unit_id: schemas.unitId,
    intervention_type: Joi.string().required(),
    start_date: schemas.date,
    end_date: schemas.optionalDate,
    note: Joi.string().allow('').optional(),
    created_by: Joi.string().optional(),
    meta: Joi.object().optional()
  }),

  // POST /api/v1/analytics/augment
  augmentData: Joi.object({
    unit_id: schemas.unitId,
    start_date: schemas.date,
    end_date: schemas.date,
    signal_type: Joi.string().valid('human', 'population').default('human')
  })
};

export default {
  validate,
  schemas,
  endpointSchemas
};

