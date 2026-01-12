# Analytics API 테스트 가이드

## 🎯 테스트 방법

### 1. Swagger UI에서 테스트 (추천)

1. 서버 실행:
```bash
npm start
```

2. 브라우저에서 접속:
```
http://localhost:8000/docs
```

3. `Analytics` 섹션에서 다음 엔드포인트 테스트:
   - `GET /api/v1/analytics/trend` - UCI 트렌드 분석
   - `GET /api/v1/analytics/complaint-trend` - 민원 트렌드 분석
   - `GET /api/v1/analytics/data-quality` - 데이터 품질 리포트
   - `POST /api/v1/analytics/augment` - 데이터 보강

4. "Try it out" 버튼 클릭 → 파라미터 입력 → "Execute" 클릭

---

### 2. curl로 테스트

#### UCI 트렌드 분석 및 예측
```bash
# 기본 (30일 분석, 7일 예측)
curl "http://localhost:8000/api/v1/analytics/trend?unit_id=11110"

# 커스텀 기간
curl "http://localhost:8000/api/v1/analytics/trend?unit_id=11110&days=60&forecast_days=14"
```

**예상 응답:**
```json
{
  "unit_id": "11110",
  "hasData": true,
  "current": {
    "uci_score": 63.14,
    "uci_grade": "D"
  },
  "trend": {
    "direction": "increasing",
    "slope": 0.5,
    "change_rate": "12.5",
    "confidence": 0.85
  },
  "forecast": [
    {
      "date": "2025-12-08",
      "value": 65.2,
      "confidence": 0.9
    }
  ],
  "moving_averages": {
    "ma7": [...],
    "ma14": [...]
  },
  "seasonality": {
    "dayOfWeek": {...},
    "monthly": {...}
  }
}
```

#### 민원 트렌드 분석
```bash
curl "http://localhost:8000/api/v1/analytics/complaint-trend?unit_id=11110&days=30"
```

#### 데이터 품질 리포트
```bash
curl "http://localhost:8000/api/v1/analytics/data-quality?start_date=2025-11-01&end_date=2025-12-01"
```

**예상 응답:**
```json
{
  "period": {
    "start": "2025-11-01",
    "end": "2025-12-01",
    "expected_days": 30
  },
  "human_signal": {
    "total_records": 1200,
    "missing_days": 5,
    "completeness": "83.33",
    "outliers": 12,
    "quality_score": 81.33
  },
  "population_signal": {
    "total_records": 900,
    "missing_days": 2,
    "completeness": "93.33",
    "quality_score": 93.33
  },
  "overall_quality": {
    "score": "87.33",
    "grade": "B"
  }
}
```

#### 데이터 보강 (결측치 채우기)
```bash
curl -X POST "http://localhost:8000/api/v1/analytics/augment" \
  -H "Content-Type: application/json" \
  -d '{
    "unit_id": "11110",
    "start_date": "2025-11-01",
    "end_date": "2025-12-01",
    "signal_type": "human"
  }'
```

---

### 3. 실제 데이터로 테스트하기

#### Step 1: 데이터 확인
```bash
# 어떤 unit_id가 있는지 확인
node -e "
import('./config/database.js').then(async ({connectDB}) => {
  await connectDB();
  const SignalHuman = (await import('./models/SignalHuman.js')).default;
  const units = await SignalHuman.distinct('unit_id', {signal_type: 'total'});
  console.log('Available unit_ids:', units.slice(0, 10));
  process.exit(0);
});
"
```

#### Step 2: UCI 트렌드 분석 테스트
```bash
# 실제 데이터가 있는 unit_id로 테스트
curl "http://localhost:8000/api/v1/analytics/trend?unit_id=11110&days=30&forecast_days=7" | jq
```

#### Step 3: 데이터 품질 리포트
```bash
# 최근 30일 데이터 품질 확인
curl "http://localhost:8000/api/v1/analytics/data-quality?start_date=2025-11-01&end_date=2025-12-01" | jq
```

---

## 🎤 발표 데모 시나리오

### 시나리오 1: 시계열 분석 데모
1. Swagger UI 열기 (`http://localhost:8000/docs`)
2. `GET /api/v1/analytics/trend` 선택
3. `unit_id=11110` 입력
4. "Execute" 클릭
5. 결과 설명:
   - "이 API는 선형 회귀를 사용하여 UCI 트렌드를 분석하고 7일 후를 예측합니다"
   - "이동평균(MA7, MA14)으로 노이즈를 제거했습니다"
   - "계절성 분석으로 요일별, 월별 패턴을 파악했습니다"

### 시나리오 2: 데이터 품질 관리 데모
1. `GET /api/v1/analytics/data-quality` 선택
2. 날짜 범위 입력 (예: `start_date=2025-11-01&end_date=2025-12-01`)
3. "Execute" 클릭
4. 결과 설명:
   - "데이터 완전성 87%, 품질 등급 B"
   - "결측치 5일, 이상치 12개 감지"
   - "데이터 품질을 체계적으로 관리합니다"

### 시나리오 3: 데이터 보강 데모
1. `POST /api/v1/analytics/augment` 선택
2. Request body 입력:
```json
{
  "unit_id": "11110",
  "start_date": "2025-11-01",
  "end_date": "2025-12-01",
  "signal_type": "human"
}
```
3. "Execute" 클릭
4. 결과 설명:
   - "베이스라인 기반으로 결측 데이터를 통계적으로 생성했습니다"
   - "데이터 신뢰도 60%로 표시하여 실제 데이터와 구분합니다"

---

## 🔍 빠른 테스트 스크립트

```bash
# 서버가 실행 중인지 확인
curl http://localhost:8000/api/v1/health

# UCI 트렌드 분석 (종로구)
curl "http://localhost:8000/api/v1/analytics/trend?unit_id=11110" | jq '.trend, .forecast[0]'

# 데이터 품질 리포트
curl "http://localhost:8000/api/v1/analytics/data-quality?start_date=2025-11-01&end_date=2025-12-01" | jq '.overall_quality'
```

---

## ⚠️ 주의사항

1. **데이터가 없는 경우**: 
   - `hasData: false` 반환
   - `available_period` 필드에 실제 사용 가능한 날짜 범위 제공
   - 구체적인 안내 메시지 포함

2. **데이터가 1개만 있는 경우**:
   - `hasData: true`, `data_quality: 'limited'` 반환
   - 기본 정보(현재 UCI 점수, 등급) 제공
   - 트렌드 분석은 "데이터 부족"으로 표시

3. **unit_id 확인**: 실제 데이터가 있는 unit_id를 사용해야 함
4. **날짜 범위**: 데이터가 있는 날짜 범위 내에서 테스트

## 🔧 데이터 부족 시 해결 방법

현재 UCI 데이터가 1일치만 있는 경우, 더 많은 데이터를 생성하려면:

```bash
# UCI 계산 스크립트 실행 (여러 날짜에 대해)
npm run compute-uci

# 또는 특정 날짜 범위로 계산
node scripts/compute_comfort_index.js --date=2025-11-01
node scripts/compute_comfort_index.js --date=2025-11-15
node scripts/compute_comfort_index.js --date=2025-12-01
```

---

## 📊 발표용 핵심 포인트

1. **시계열 분석**: "선형 회귀 기반 트렌드 예측으로 미래 7일을 예측합니다"
2. **데이터 보강**: "통계적 방법으로 결측 데이터를 보강하여 분석 범위를 확장합니다"
3. **품질 관리**: "데이터 완전성과 이상치를 자동으로 감지하여 품질을 관리합니다"

