# 베이스라인 데이터 통합 구현 계획

## 📋 요약

**데이터**: 서울시 스마트 불편신고 분야별 신고 현황 (2025년 8-12월)
**목적**: Core Engine 우선순위 결정 로직 강화

---

## 🎯 1. 컬렉션 설계

### `baseline_metrics` 컬렉션 (신규)

```javascript
{
  period: "2025-08",              // YYYY-MM
  category: "전체" | "청소" | "환경" | ...,
  citywide_total: 12345,           // 서울시 전체 신고량
  citywide_avg_per_unit: 333.65,  // 단위당 평균
  growth_rate: 0.15,               // 전월 대비 증가율
  source: "smart_complaint",
  created_at: Date
}
```

**인덱스**: `{ period: 1, category: 1 }` unique

---

## 🔧 2. Priority Score 계산식 통합

### 현재 구조
```javascript
humanScore = (
  total_complaints * 0.2 +
  odor_ratio * 0.2 +
  trash_ratio * 0.15 +
  ...
)
```

### 개선된 구조 (베이스라인 보정)

```javascript
humanScore = (
  total_complaints * 0.15 +           // 절대값 (가중치 감소)
  relative_to_baseline * 0.20 +       // 베이스라인 대비 (신규) ⭐
  excess_growth_rate * 0.15 +         // 초과 증가율 (신규) ⭐
  odor_ratio * 0.15 +
  trash_ratio * 0.12 +
  ...
)
```

**핵심 로직**:
- `relative_to_baseline = unit_avg / baseline_avg`
  - > 1.5: 서울시 평균 대비 1.5배 이상 → 가중치 증가
- `excess_growth_rate = unit_growth_rate - baseline_growth_rate`
  - > 0.2: 베이스라인 증가율보다 20%p 이상 높음 → 가중치 증가

---

## 📝 3. Action Card 설명 강화

### Before
```
"악취 민원 증가율이 높고(상위 5%), 야간 집중도가 높아..."
```

### After
```
"해당 지역은 동일 분야의 서울시 평균 대비 최근 2개월 신고 증가율이 35%p 높고, 
 서울시 전체 평균 대비 1.8배 높은 신고량을 보여 구조적 문제 가능성이 있습니다."
```

---

## 🗂️ 4. 파이프라인 통합 위치

### ✅ 구현 완료

1. **모델**: `models/BaselineMetric.js` ✅
2. **ETL 스크립트**: `scripts/etl_baseline_metrics.js` ✅
3. **UCI 계산 수정**: `services/uciCompute.js` ✅
   - `computeHumanScore` 함수에 베이스라인 보정 추가
   - `generateExplain` 함수에 베이스라인 문구 추가
4. **Action Card 수정**: `routes/actionCards.js` ✅
   - 베이스라인 비교 문구 자동 생성

### 📦 패키지 추가 필요

```bash
npm install xlsx
```

---

## ⚠️ 5. 지금 당장 안 해도 되는 것

### Phase 1: 기본 통합 (✅ 완료)
- [x] baseline_metrics 모델
- [x] ETL 스크립트
- [x] UCI 계산 보정
- [x] Action Card 설명 강화

### Phase 2: 고도화 (⏸️ 추후)
- [ ] **계절성 보정**: 데이터가 5개월뿐이라 패턴 파악 불가
- [ ] **카테고리 세분화**: 현재는 전체/청소/환경 정도만
- [ ] **실시간 업데이트**: 월별 자동 업데이트 스크립트
- [ ] **베이스라인 API**: 내부 계산용으로만 사용 (요구사항에 없음)

---

## 🚀 사용 방법

### 1. 베이스라인 데이터 임포트
```bash
npm install xlsx  # XLSX 파일 처리용
npm run etl-baseline
```

### 2. UCI 재계산 (베이스라인 반영)
```bash
npm run compute-uci
```

### 3. Priority Queue 재생성
```bash
npm run priority
```

---

## 📊 데이터 흐름

```
CSV/XLSX (서울시 전체 집계)
    ↓
ETL (etl_baseline_metrics.js)
    ↓
baseline_metrics (MongoDB)
    ↓
UCI 계산 시 조회
    ↓
computeHumanScore() 보정
    ↓
Priority Queue / Action Cards
```

---

## 🎯 핵심 개선 효과

### Before
- "이 동네 민원이 많다" → 절대값만 비교
- "증가율이 높다" → 지역 내부 비교만

### After
- "이 동네 민원이 서울시 평균 대비 1.8배 많다" → 상대적 비교
- "증가율이 서울시 전체 증가율보다 35%p 높다" → 베이스라인 대비 비교
- "원래 많이 나오는 동네" vs "최근 갑자기 튀는 동네" 구분 가능

---

## 📌 다음 단계

1. ✅ `npm install xlsx` 실행
2. ✅ `npm run etl-baseline` 실행
3. ✅ `npm run compute-uci` 재실행
4. ✅ Priority Queue 확인

