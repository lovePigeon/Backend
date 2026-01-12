# 백엔드 + 데이터 분석 개발자 TODO

## 🎯 현재 상태 분석

### ✅ 완료된 작업
1. **데이터 모델** (9개 컬렉션)
   - SpatialUnit, SignalHuman, SignalGeo, SignalPopulation
   - ComfortIndex, BaselineMetric, TimePatternTemplate
   - CleanupLog, Intervention, AnomalySignal

2. **ETL 파이프라인**
   - 모든 데이터 소스 임포트 스크립트
   - 데이터 전처리 및 변환

3. **UCI 계산 로직**
   - Human/Geo/Population 신호 통합
   - 베이스라인 비교
   - 정규화 및 가중치 적용

4. **API 엔드포인트**
   - Priority Queue, Action Cards, Dashboard
   - UCI 계산, 이상 탐지
   - Swagger 문서화

5. **AI 이상 탐지**
   - 무료 로컬 비지도 학습
   - Priority Queue 통합

---

## ⚠️ 개선/추가 필요 사항

### 1. 테스트 코드 (중요도: ⭐⭐⭐⭐⭐)

**현재 상태:**
- Python 테스트 파일만 존재 (FastAPI 전용)
- Jest 설정은 있지만 실제 테스트 파일 없음
- Node.js API에 대한 테스트 부재

**필요 작업:**
```bash
# Unit Tests
- services/uciCompute.js 테스트
- services/anomalyDetection.js 테스트
- services/normalization.js 테스트

# Integration Tests
- API 엔드포인트 테스트 (supertest 사용)
- Priority Queue 로직 테스트
- ETL 스크립트 테스트

# 테스트 파일 예시 구조:
tests/
  unit/
    uciCompute.test.js
    anomalyDetection.test.js
    normalization.test.js
  integration/
    priority.test.js
    comfortIndex.test.js
    anomaly.test.js
  e2e/
    api.test.js
```

**추가 패키지:**
```json
{
  "devDependencies": {
    "supertest": "^6.3.3",
    "@mongodb-js/mongodb-memory-server": "^9.0.0"
  }
}
```

---

### 2. 데이터 검증 및 품질 체크 (중요도: ⭐⭐⭐⭐)

**필요 작업:**
```javascript
// scripts/validate_data.js
- 데이터 완전성 체크 (missing values)
- 데이터 일관성 체크 (date 범위, unit_id 매칭)
- 이상치 자동 감지 (통계적 방법)
- 중복 데이터 체크
```

**검증 항목:**
- `signals_human.date` 범위 확인
- `unit_id`가 `spatial_units`에 존재하는지 확인
- 날짜별 데이터 완전성 (특정 날짜에 데이터가 누락되었는지)
- 값의 범위 체크 (예: `uci_score` 0-100, `anomaly_score` 0-1)

---

### 3. 성능 최적화 (중요도: ⭐⭐⭐⭐)

**현재 문제:**
- Priority Queue에서 여러 쿼리 실행 (개선 가능)
- 대량 데이터 조회 시 메모리 사용량

**필요 작업:**
```javascript
// 1. 인덱스 최적화 (일부는 이미 있지만 재검토)
- 복합 인덱스 추가: { unit_id: 1, date: -1, signal_type: 1 }
- 쿼리 패턴 분석 및 인덱스 튜닝

// 2. 쿼리 최적화
- Priority Queue: aggregation pipeline 사용
- .lean() 사용 (이미 일부 적용됨)
- select()로 필요한 필드만 조회

// 3. 캐싱 (Redis 선택적)
- 자주 조회되는 데이터 캐싱 (Priority Queue 상위 20개)
- 날짜별 UCI 계산 결과 캐싱
```

**예시:**
```javascript
// routes/priority.js 개선
const items = await ComfortIndex.aggregate([
  { $match: { date: targetDate } },
  { $lookup: { ... } }, // join with anomaly_signals
  { $sort: { uci_score: -1 } },
  { $limit: parseInt(top_n) }
]);
```

---

### 4. 입력 데이터 검증 (중요도: ⭐⭐⭐⭐)

**현재 상태:**
- Joi 설치되어 있지만 모든 엔드포인트에 적용 안됨
- 기본적인 타입 체크만 있음

**필요 작업:**
```javascript
// middleware/validate.js
- Request body 검증 (Joi 스키마)
- Query parameter 검증
- Path parameter 검증

// 예시:
POST /api/v1/comfort-index/compute
- date: YYYY-MM-DD 형식 체크
- window_weeks: 1-12 범위 체크
- unit_id: 존재하는 unit_id인지 체크
```

---

### 5. 에러 핸들링 및 로깅 (중요도: ⭐⭐⭐)

**현재 상태:**
- 기본적인 try-catch는 있음
- console.log/error 사용 (구조화되지 않음)

**필요 작업:**
```javascript
// utils/logger.js
- winston 또는 pino 사용
- 로그 레벨 분리 (info, warn, error)
- 에러 스택 추적 개선

// middleware/errorHandler.js
- 구조화된 에러 응답
- 에러 코드 체계
- 프로덕션/개발 환경 분리
```

**예시:**
```javascript
// winston 사용
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

### 6. 배치 작업 스케줄링 (중요도: ⭐⭐⭐)

**필요 작업:**
```javascript
// scripts/scheduler.js 또는 cron job 설정
- 매일 자정: UCI 계산
- 매주 월요일: 이상 탐지 실행
- 매일 오전: 데이터 검증
```

**옵션:**
1. **node-cron** (로컬 스케줄러)
```javascript
import cron from 'node-cron';

cron.schedule('0 0 * * *', async () => {
  // 매일 자정 UCI 계산
  await runComputeUCI();
});
```

2. **외부 스케줄러** (cron, systemd, Kubernetes CronJob)
3. **API 엔드포인트로 노출** 후 외부에서 호출

---

### 7. 데이터 일관성 체크 (중요도: ⭐⭐⭐)

**필요 작업:**
```javascript
// scripts/check_data_consistency.js
- signals_human의 unit_id가 spatial_units에 존재하는지
- comfort_index의 unit_id와 date가 signals와 일치하는지
- 날짜 범위 일관성 (예: comfort_index의 date가 signals_human의 최신 날짜 이내인지)
```

---

### 8. API Rate Limiting (중요도: ⭐⭐)

**필요 작업:**
```javascript
// middleware/rateLimiter.js
- express-rate-limit 사용
- 엔드포인트별 제한
- API Key 기반 제한 (필요 시)
```

---

### 9. 문서화 개선 (중요도: ⭐⭐)

**추가 문서:**
- API 사용 예시 (Postman Collection)
- 데이터 흐름도 (Mermaid 다이어그램)
- 아키텍처 문서
- 배포 가이드
- 트러블슈팅 가이드

---

### 10. 환경 변수 검증 (중요도: ⭐⭐⭐)

**필요 작업:**
```javascript
// config/env.js
- 시작 시 필수 환경 변수 체크
- .env.example 파일 업데이트

// 예시:
const requiredEnvVars = ['MONGODB_URI', 'PORT'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

---

## 📊 우선순위 추천

### 즉시 필요 (발표/데모 전)
1. ✅ **테스트 코드** (최소한 핵심 API)
2. ✅ **데이터 검증 스크립트** (데이터 품질 확인)
3. ✅ **입력 데이터 검증** (API 안정성)

### 단기 (1-2주)
4. ✅ **성능 최적화** (쿼리 최적화, 인덱스)
5. ✅ **에러 핸들링/로깅** (운영 안정성)
6. ✅ **배치 작업 스케줄링** (자동화)

### 중기 (1개월)
7. ✅ **데이터 일관성 체크** (데이터 신뢰성)
8. ✅ **API Rate Limiting** (보안/안정성)
9. ✅ **문서화 개선** (유지보수성)

---

## 🚀 빠른 시작 가이드

### 1. 테스트 코드 작성 (가장 중요)
```bash
npm install --save-dev supertest @mongodb-js/mongodb-memory-server
```

### 2. 데이터 검증 스크립트
```bash
# 새 스크립트 생성
scripts/validate_data.js
```

### 3. 입력 검증 미들웨어
```bash
# middleware/validate.js 생성
# routes에 적용
```

---

## 📝 체크리스트

- [ ] 테스트 코드 작성 (최소 5개 핵심 테스트)
- [ ] 데이터 검증 스크립트
- [ ] 입력 데이터 검증 (Joi)
- [ ] 성능 최적화 (쿼리, 인덱스)
- [ ] 로깅 시스템 (winston/pino)
- [ ] 배치 작업 스케줄러
- [ ] 데이터 일관성 체크
- [ ] 환경 변수 검증
- [ ] .env.example 파일
- [ ] API Rate Limiting

