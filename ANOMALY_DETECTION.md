# AI 이상 탐지 컴포넌트 (Anomaly Detection)

## 개요

**무료 로컬 AI 컴포넌트**로, 비지도 학습(Unsupervised Learning)을 사용하여 도시 환경의 급격한 악화 신호를 조기에 감지합니다.

## 왜 이것이 AI인가?

### 1. 비지도 학습 (Unsupervised Learning)
- **라벨 불필요**: "정상" 또는 "이상"이라는 라벨이 필요 없음
- **패턴 학습**: 과거 데이터에서 정상 패턴을 자동으로 학습
- **적응형**: 각 지역(unit_id)마다 고유한 기준선(baseline)을 학습

### 2. 통계적 이상 탐지 (Statistical Anomaly Detection)
- **Z-score 기반**: 표준편차를 사용한 통계적 방법
- **롤링 통계**: 최근 8주간 데이터로 기준선 계산
- **임계값 기반**: Z-score > 2.5 또는 anomaly_score > 0.7 시 이상으로 판단

### 3. Early Warning (예측이 아닌 조기 경보)
- **급격한 변화 감지**: 민원이 갑자기 급증하는 패턴 감지
- **변화율 중심**: 절대값이 아닌 변화율에 집중
- **우선순위 부스팅**: UCI와 함께 사용하여 긴급 조치가 필요한 지역 식별

## 왜 라벨이 필요 없는가?

1. **통계적 편차 사용**: 과거 평균과 표준편차를 기준으로 판단
2. **상대적 비교**: 최근 4주 vs 과거 8주 비교
3. **임계값 기반**: 통계적으로 유의미한 편차만 이상으로 판단

## 데이터 구조

### MongoDB Collection: `anomaly_signals`

```javascript
{
  unit_id: String,           // 지역 ID
  date: String,              // 날짜 (YYYY-MM-DD)
  anomaly_score: Number,     // 이상 점수 (0-1, 높을수록 이상)
  anomaly_flag: Boolean,     // 이상 플래그 (true면 급격한 악화)
  features: {
    complaint_change_4w: Number,      // 4주간 민원 변화율
    complaint_growth_rate: Number,     // 민원 증가율
    night_ratio_change: Number,        // 야간 비율 변화
    population_change_rate: Number     // 인구 변화율
  },
  stats: {
    z_score: Number,          // Z-score (표준편차 단위)
    rolling_mean: Number,    // 롤링 평균
    rolling_std: Number      // 롤링 표준편차
  },
  explanation: String        // 이상 탐지 설명
}
```

## 알고리즘

### 1. 특징 추출 (Feature Extraction)

최근 4주간 데이터에서 다음 특징을 추출:

- **민원 변화율**: 최근 4주 vs 과거 8주 민원 총량 비교
- **민원 증가율**: 최근 평균 vs 과거 평균 비교
- **야간 비율 변화**: 야간 민원 비율의 변화
- **인구 변화율**: 생활인구 변화율

### 2. 복합 점수 계산 (Composite Score)

```javascript
compositeScore = 
  complaint_change_4w * 0.4 +
  complaint_growth_rate * 0.3 +
  |night_ratio_change| * 0.2 +
  |population_change_rate| * 0.1
```

### 3. Z-score 계산

```javascript
z_score = (compositeScore - rolling_mean) / rolling_std
```

- `rolling_mean`: 과거 8주간의 복합 점수 평균
- `rolling_std`: 과거 8주간의 복합 점수 표준편차

### 4. 이상 점수 변환

```javascript
anomaly_score = 0.5 + (z_score / 5.0)  // 0-1 범위로 정규화
anomaly_flag = (anomaly_score > 0.7) || (|z_score| > 2.5)
```

## 사용 방법

### 1. 이상 탐지 실행

```bash
# 모든 지역에 대해 이상 탐지 실행
npm run compute-anomaly

# 특정 날짜에 대해 실행
npm run compute-anomaly 2025-12-01

# 특정 지역만 실행
npm run compute-anomaly 2025-12-01 11110
```

### 2. API에서 사용

#### Priority Queue API

`GET /api/v1/priority-queue?date=2025-12-01`

응답에 다음 필드가 포함됩니다:

```json
{
  "rank": 1,
  "unit_id": "11110515",
  "uci_score": 63.14,
  "anomaly_score": 0.85,
  "anomaly_flag": true,
  "anomaly_explanation": "최근 4주 민원이 45% 증가, 통계적 이상치 감지 (Z-score: 3.2) - 급격한 악화 신호",
  "why_summary": "... [AI 이상 탐지] 최근 4주 민원이 45% 증가..."
}
```

**우선순위 부스팅**: `anomaly_flag === true`인 경우 UCI 점수에 가산점이 부여되어 우선순위가 상승합니다.

#### Comfort Index API

`GET /api/v1/comfort-index/{unit_id}?date=2025-12-01`

응답에 `anomaly` 필드가 포함됩니다:

```json
{
  "unit_id": "11110515",
  "uci_score": 63.14,
  "anomaly": {
    "anomaly_score": 0.85,
    "anomaly_flag": true,
    "explanation": "최근 4주 민원이 45% 증가..."
  }
}
```

## 통합 흐름

```
1. 데이터 수집 (signals_human, signals_population)
   ↓
2. 이상 탐지 실행 (compute_anomaly_scores.js)
   ↓
3. anomaly_signals 컬렉션에 저장
   ↓
4. Priority Queue 조회 시:
   - anomaly_flag가 true면 UCI 점수에 가산점 부여
   - why_summary에 이상 탐지 설명 추가
   ↓
5. 프론트엔드에 anomaly_score, anomaly_flag, anomaly_explanation 전달
```

## 발표용 설명

### "AI 컴포넌트가 어떻게 작동하나요?"

1. **비지도 학습**: 과거 데이터에서 정상 패턴을 자동으로 학습합니다.
2. **통계적 방법**: Z-score를 사용하여 통계적으로 유의미한 편차를 감지합니다.
3. **Early Warning**: 민원이 급격히 증가하는 패턴을 조기에 감지하여 행정 자원을 효율적으로 배치할 수 있게 합니다.

### "왜 라벨이 필요 없나요?"

- 통계적 편차를 사용: 과거 평균 대비 얼마나 벗어났는지 계산
- 상대적 비교: 최근 4주 vs 과거 8주 비교
- 임계값 기반: 통계적으로 유의미한 편차만 이상으로 판단

### "예측이 아닌 Early Warning인 이유는?"

- **예측**: "내일 민원이 몇 건 발생할 것이다" (미래 값 예측)
- **Early Warning**: "최근 민원이 비정상적으로 급증하고 있다" (현재 패턴 감지)

우리는 **Early Warning**에 집중하여, 급격한 악화 신호를 조기에 감지하고 우선순위를 부여합니다.

## 설정

`services/anomalyDetection.js`에서 다음을 조정할 수 있습니다:

- **특징 가중치**: `complaint_change_4w`, `complaint_growth_rate` 등의 가중치
- **임계값**: `anomaly_score > 0.7` 또는 `z_score > 2.5`
- **윈도우 크기**: 최근 4주, 기준선 8주

## 참고

- **무료**: 외부 API나 유료 서비스 사용 없음
- **로컬**: 모든 계산이 서버에서 실행됨
- **설명 가능**: 통계적 방법이므로 결과를 쉽게 설명 가능
- **확장 가능**: Isolation Forest 등 다른 알고리즘으로 확장 가능

