/**
 * Logger Utility
 * 
 * 구조화된 로깅 시스템
 * - 프로덕션/개발 환경 분리
 * - 로그 레벨 분리
 * - 에러 스택 추적
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 간단한 로거 (winston 없이 구현)
 * 프로덕션에서는 winston 사용 권장
 */
const logger = {
  info: (...args) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },

  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },

  error: (...args) => {
    console.error('[ERROR]', ...args);
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  }
};

export default logger;

