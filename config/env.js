/**
 * Environment Variables Validation
 * 
 * 서버 시작 시 필수 환경 변수를 검증합니다.
 */

import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'MONGODB_URI'
];

const optionalEnvVars = {
  'PORT': 8000,
  'NODE_ENV': 'development'
};

/**
 * 환경 변수 검증 및 기본값 설정
 */
export function validateEnv() {
  const missing = [];
  
  // 필수 환경 변수 체크
  requiredEnvVars.forEach(varName => {
    // MONGODB_URI가 없으면 개별 설정 확인
    if (varName === 'MONGODB_URI') {
      const hasUri = process.env.MONGODB_URI;
      const hasIndividual = process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && process.env.MONGODB_CLUSTER;
      
      if (!hasUri && !hasIndividual) {
        missing.push(varName);
      }
    } else {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file or set these variables.\n` +
      `See .env.example for reference.`
    );
  }

  // 선택적 환경 변수에 기본값 설정
  Object.keys(optionalEnvVars).forEach(varName => {
    if (!process.env[varName]) {
      process.env[varName] = String(optionalEnvVars[varName]);
    }
  });

  console.log('✅ Environment variables validated');
}

export default {
  validateEnv
};

