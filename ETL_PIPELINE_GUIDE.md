# ETL 파이프라인 가이드

## 📋 개요

민원 CSV 데이터를 MongoDB에 저장하고, comfort_index를 계산하며, priority_queue, action_cards, blind_spots를 자동 생성하는 전체 파이프라인입니다.

---

## 🔄 파이프라인 구조

### 1. CSV → signals_human (ETL)

**목적**: 민원 CSV 데이터를 signal_type별로 분리하여 저장

**최종 구조**:
```javascript
{
  unit_id: "11110500",
  date: "2020-01-01",
  signal_type: "total" | "odor" | "trash" | "illegal_dumping" | "night_ratio" | "repeat_ratio",
  value: 100,  // count, rate, zscore 등
  meta: {
    source: "csv_import",
    category: "complaint" | "ratio",
    raw: { ... }  // 원본 CSV 행
  }
}
```

**실행**:
```bash
npm run etl
# 또는
node scripts/etl_human_signals.js
```

---

### 2. comfort_index 계산

**목적**: human/geo/population 신호를 정규화하여 가중합으로 UCI 점수 계산

**실행**:
```bash
npm run compute-uci
# 또는
node scripts/compute_comfort_index.js [date] [window_weeks]

# 예시
node scripts/compute_comfort_index.js 2020-01-01 4
```

**결과**: `comfort_index` 컬렉션에 저장
- `uci_score`: 0-100 점수
- `uci_grade`: A-E 등급
- `components`: 각 신호 그룹 점수 및 정규화값
- `explain`: 자동 요약 근거

---

### 3. priority_queue 생성

**목적**: comfort_index 상위 N개 + "왜" 요약

**실행**:
```bash
npm run priority
# 또는
node scripts/generate_priority_queue.js [date] [top_n]

# 예시
node scripts/generate_priority_queue.js 2020-01-01 20
```

**결과**: 콘솔에 출력 (API는 `/api/v1/priority-queue` 사용)

---

### 4. action_cards 생성

**목적**: 룰 기반으로 개입 권고사항 생성

**실행**: API를 통해 자동 생성
```bash
curl "http://localhost:8000/api/v1/action-cards?date=2020-01-01"
```

**룰 예시**:
- `night_ratio > 0.6` → 야간 집중 관리 권고
- `repeat_ratio > 0.5` → 구조 원인 조사 권고
- `geo 취약도 높음` → 시설 개선 권고

---

### 5. blind_spots 생성

**목적**: 민원 낮은데 geo/pop/pigeon이 튀는 곳 탐지

**실행**:
```bash
npm run blind-spots
# 또는
node scripts/generate_blind_spots.js [date] [risk_level]

# 예시
node scripts/generate_blind_spots.js 2020-01-01 high
```

**판단 로직**:
- 민원 평균 < 1건
- AND (geo 취약도 > 6 OR 생활인구 급증 > 15%)

---

## 🚀 전체 파이프라인 실행

한 번에 모든 단계 실행:

```bash
npm run pipeline
# 또는
node scripts/run_etl_pipeline.js
```

**실행 순서**:
1. ETL Human Signals
2. Compute Comfort Index
3. Generate Priority Queue
4. Generate Blind Spots
5. Action Cards (API로 자동 생성)

---

## 📊 데이터 흐름

```
CSV 파일 (data/raw/)
    ↓
ETL (signal_type별 분리)
    ↓
signals_human (MongoDB)
    ↓
+ signals_geo
+ signals_population
    ↓
comfort_index 계산
    ↓
comfort_index (MongoDB)
    ↓
priority_queue 생성
action_cards 생성 (API)
blind_spots 생성
```

---

## 🔧 주요 변경사항

### SignalHuman 모델 변경

**이전**:
```javascript
{
  unit_id: "...",
  date: "...",
  complaint_total: 100,
  complaint_odor: 20,
  complaint_trash: 30,
  ...
}
```

**현재**:
```javascript
{
  unit_id: "...",
  date: "...",
  signal_type: "total" | "odor" | "trash" | ...,
  value: 100,
  meta: { source, category, raw }
}
```

### uciCompute.js 수정

- `signal_type`별로 데이터 조회
- `value` 필드 사용

---

## 📝 사용 예시

### 1. 새 CSV 파일 추가 후 ETL

```bash
# CSV 파일을 data/raw/에 복사
cp new_data.csv data/raw/

# ETL 실행
npm run etl
```

### 2. 특정 날짜 기준으로 UCI 계산

```bash
node scripts/compute_comfort_index.js 2024-01-28 4
```

### 3. Priority Queue 조회

```bash
# 스크립트로 생성
npm run priority

# 또는 API로 조회
curl "http://localhost:8000/api/v1/priority-queue?date=2024-01-28&top_n=20"
```

### 4. Blind Spots 조회

```bash
# 스크립트로 생성
npm run blind-spots

# 또는 API로 조회 (dashboard/blind-spots 엔드포인트)
curl "http://localhost:8000/api/v1/dashboard/blind-spots?date=2024-01-28"
```

---

## ⚠️ 주의사항

1. **기존 데이터 마이그레이션**: 기존 `signals_human` 데이터는 새로운 구조로 변환 필요
2. **인덱스**: `{ unit_id: 1, date: 1, signal_type: 1 }` unique 인덱스 사용
3. **성능**: 대용량 데이터는 배치 처리 (현재 100개씩)

---

## 🔄 다음 단계

1. **interventions**: 조치 입력 UI 구현
2. **before/after tracking**: 개입 전후 효과 추적
3. **자동화**: Cron job으로 주기적 실행

