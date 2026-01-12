/**
 * Error Handler Middleware
 * 
 * 구조화된 에러 핸들링
 * - 프로덕션/개발 환경 분리
 * - 에러 코드 체계
 * - 구조화된 에러 응답
 */

import logger from '../utils/logger.js';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 에러 코드 정의
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  COMPUTATION_ERROR: 'COMPUTATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * 커스텀 에러 클래스
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 에러 핸들링 미들웨어
 */
export function errorHandler(err, req, res, next) {
  // Joi 검증 에러 처리
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation error',
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // AppError 처리
  if (err instanceof AppError) {
    logger.error(`[${err.code}] ${err.message}`, {
      path: req.path,
      method: req.method,
      details: err.details
    });

    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(isDevelopment && err.details && { details: err.details })
    });
  }

  // MongoDB 에러 처리
  if (err.name === 'MongoServerError' || err.name === 'MongoError') {
    logger.error(`[DATABASE_ERROR] ${err.message}`, {
      path: req.path,
      method: req.method
    });

    return res.status(500).json({
      success: false,
      code: ErrorCodes.DATABASE_ERROR,
      message: 'Database error occurred',
      ...(isDevelopment && { error: err.message })
    });
  }

  // 기타 에러 처리
  logger.error(`[INTERNAL_ERROR] ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Internal server error',
    ...(isDevelopment && { error: err.message, stack: err.stack })
  });
}

/**
 * 404 핸들러
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: ErrorCodes.NOT_FOUND,
    message: '요청한 엔드포인트를 찾을 수 없습니다.',
    path: req.path
  });
}

export default {
  errorHandler,
  notFoundHandler,
  AppError,
  ErrorCodes
};

