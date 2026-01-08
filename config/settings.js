import dotenv from 'dotenv';

dotenv.config();

export const settings = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/living_lab',
  port: process.env.PORT || 8000,
  environment: process.env.NODE_ENV || 'development',

  // UCI 계산 설정
  defaultWindowWeeks: 4,
  uciWeights: {
    human: 0.5,
    geo: 0.3,
    population: 0.2,
    pigeon: 0.0  // 기본 비활성화
  },

  // 등급 컷오프 (높을수록 위험)
  gradeCutoffs: {
    A: 0.0,   // 0-20
    B: 20.0,  // 20-40
    C: 40.0,  // 40-60
    D: 60.0,  // 60-80
    E: 80.0   // 80-100
  },

  // 정규화 설정
  winsorizePercentile: 0.05,  // 상하 5%
  useRobustScaling: true,

  // Action Cards 설정
  actionCardConfidenceThreshold: 0.5
};

