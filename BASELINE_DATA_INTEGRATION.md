# 베이스라인 데이터 통합 계획

## 📋 개요

**데이터**: 서울시 스마트 불편신고 분야별 신고 현황 (2025년 8-12월)
**목적**: Core Engine의 우선순위 결정 로직 강화 (베이스라인 및 증가율 판단 기준)

---

## 🎯 데이터 활용 전략

### 1. 컬렉션 설계 제안

#### 옵션 A: `baseline_metrics` 컬렉션 (권장)

```javascript
{
  _id: ObjectId,
  period: "2025-08",           // YYYY-MM 형식
  category: "쓰레기" | "악취" | "무단투기" | "전체",
  citywide_total: 12345,        // 서울시 전체 신고량
  citywide_avg_per_unit: 123.5, // 단위당 평균 (선택적)
  growth_rate: 0.15,            // 전월 대비 증가율
  seasonal_factor: 1.2,         // 계절성 보정 계수 (선택적)
  source: "smart_complaint",
  created_at: Date
}
```

**인덱스**:
- `{ period: 1, category: 1 }` unique
- `{ period: -1 }`

**장점**:
- 베이스라인 데이터를 명확히 분리
- 기존 signals_human과 독립적
- 확장 용이 (다른 베이스라인 소스 추가 가능)

#### 옵션 B: `signals_human`에 메타 필드 추가

기존 구조에 `baseline_reference` 필드 추가

**단점**:
- signals_human이 복잡해짐
- 베이스라인은 지역별이 아닌 시 전체 데이터

**결론**: **옵션 A (baseline_metrics) 권장**

---

## 🔧 Priority Score 계산식 통합

### 현재 구조
```javascript
humanScore = (
  normalized.total_complaints * 0.2 +
  normalized.odor_ratio * 0.2 +
  normalized.trash_ratio * 0.15 +
  normalized.illegal_dump_ratio * 0.15 +
  normalized.night_ratio * 0.15 +
  normalized.repeat_ratio * 0.15
)
```

### 개선된 구조 (베이스라인 보정)

```javascript
// 1. 지역별 절대값 정규화 (기존)
normalized.total_complaints = Math.min(1.0, (totalComplaints / windowDays) / 10.0);

// 2. 베이스라인 대비 상대값 계산 (신규)
const baseline = getBaselineForPeriod(period, category);
const relativeToBaseline = baseline.citywide_avg_per_unit > 0
  ? (unitAvgComplaints / baseline.citywide_avg_per_unit)
  : 1.0;

// 3. 증가율 보정 (신규)
const baselineGrowthRate = baseline.growth_rate || 0;
const unitGrowthRate = calculateUnitGrowthRate(totalSignals);
const excessGrowthRate = Math.max(0, unitGrowthRate - baselineGrowthRate);

// 4. 최종 humanScore 계산
humanScore = (
  normalized.total_complaints * 0.15 +           // 절대값 (가중치 감소)
  relativeToBaseline * 0.20 +                    // 베이스라인 대비 (신규)
  excessGrowthRate * 0.15 +                      // 초과 증가율 (신규)
  normalized.odor_ratio * 0.15 +                 // 기존 (가중치 감소)
  normalized.trash_ratio * 0.12 +                // 기존 (가중치 감소)
  normalized.illegal_dump_ratio * 0.12 +         // 기존 (가중치 감소)
  normalized.night_ratio * 0.11                  // 기존 (가중치 감소)
)
```

**핵심 로직**:
- `relativeToBaseline > 1.5`: 서울시 평균 대비 1.5배 이상 → 가중치 증가
- `excessGrowthRate > 0.2`: 베이스라인 증가율보다 20%p 이상 높음 → 가중치 증가

---

## 📊 Action Card 설명 강화

### 현재
```javascript
why: "악취 민원 증가율이 높고(상위 5%), 야간 집중도가 높아..."
```

### 개선 후
```javascript
why: "해당 지역은 동일 분야(악취)의 서울시 평균 대비 최근 2개월 신고 증가율이 35%p 높고, 
      서울시 전체 평균 대비 1.8배 높은 신고량을 보여 구조적 문제 가능성이 있습니다."
```

**구현 위치**: `routes/actionCards.js`의 `generateCardForUnit` 함수

---

## 🗂️ 파이프라인 통합 위치

### 1. ETL 단계 (신규)
**파일**: `scripts/etl_baseline_metrics.js`

```javascript
// CSV/XLSX → baseline_metrics 컬렉션
// - period별 집계
// - category별 분류
// - citywide_total, growth_rate 계산
```

### 2. UCI 계산 단계 (수정)
**파일**: `services/uciCompute.js`

```javascript
// computeHumanScore 함수 수정
// - getBaselineForPeriod() 호출 추가
// - relativeToBaseline, excessGrowthRate 계산 추가
```

### 3. Action Card 생성 단계 (수정)
**파일**: `routes/actionCards.js`

```javascript
// generateCardForUnit 함수 수정
// - 베이스라인 비교 문구 추가
```

---

## ⚠️ 지금 당장 안 해도 되는 것

### 1. 계절성 보정 (Seasonal Adjustment)
- **이유**: 데이터가 5개월(8-12월)뿐이라 계절성 패턴 파악 불가
- **추후**: 1년 이상 데이터 축적 후 구현

### 2. 카테고리별 세분화
- **현재**: 전체/쓰레기/악취/무단투기 정도만
- **추후**: 더 세분화된 카테고리 필요 시 확장

### 3. 실시간 베이스라인 업데이트
- **현재**: 정적 데이터로 충분
- **추후**: 월별 자동 업데이트 스크립트 필요 시 추가

### 4. 베이스라인 API 엔드포인트
- **이유**: "새로운 API 엔드포인트를 만들지 않는다"는 요구사항
- **현재**: 내부 계산용으로만 사용

---

## 📝 구현 우선순위

### Phase 1: 기본 통합 (필수)
1. ✅ `baseline_metrics` 모델 생성
2. ✅ `etl_baseline_metrics.js` 스크립트 작성
3. ✅ `uciCompute.js`의 `computeHumanScore` 수정
4. ✅ 베이스라인 조회 헬퍼 함수 추가

### Phase 2: 설명 강화 (권장)
5. ✅ `actionCards.js`의 설명 문구 개선
6. ✅ Priority Queue의 `why_summary`에 베이스라인 정보 포함

### Phase 3: 고도화 (선택)
7. ⏸️ 계절성 보정
8. ⏸️ 카테고리 세분화
9. ⏸️ 자동 업데이트 스크립트

---

## 🔍 데이터 구조 예시

### 입력 데이터 (CSV)
```
period, category, total, growth_rate
2025-08, 전체, 12345, 0.05
2025-08, 쓰레기, 3456, 0.08
2025-08, 악취, 1234, 0.12
...
```

### MongoDB 저장 형태
```javascript
{
  period: "2025-08",
  category: "전체",
  citywide_total: 12345,
  citywide_avg_per_unit: 333.65,  // 12345 / 37 units
  growth_rate: 0.05,
  source: "smart_complaint",
  created_at: ISODate("2025-08-01T00:00:00Z")
}
```

---

## 🎯 핵심 개선 효과

### Before (현재)
- "이 동네 민원이 많다" → 절대값만 비교
- "증가율이 높다" → 지역 내부 비교만

### After (개선 후)
- "이 동네 민원이 서울시 평균 대비 1.8배 많다" → 상대적 비교
- "증가율이 서울시 전체 증가율보다 35%p 높다" → 베이스라인 대비 비교
- "원래 많이 나오는 동네" vs "최근 갑자기 튀는 동네" 구분 가능

---

## 📌 다음 단계

1. CSV/XLSX 파일 구조 확인
2. `baseline_metrics` 모델 생성
3. ETL 스크립트 작성
4. `uciCompute.js` 수정
5. 테스트 및 검증

