# 베이스라인 데이터 통합 완료 요약

## ✅ 구현 완료

### 1. 컬렉션 설계
- **`baseline_metrics` 컬렉션** 생성
- 구조: `period`, `category`, `citywide_total`, `citywide_avg_per_unit`, `growth_rate`
- 인덱스: `{ period: 1, category: 1 }` unique

### 2. ETL 파이프라인
- **`scripts/etl_baseline_metrics.js`** 작성
- CSV/XLSX 파일 자동 파싱
- **현재 상태**: 1,436개 베이스라인 메트릭 저장 완료
- **기간**: 2012-08 ~ 2025-11 (약 13년치 데이터)

### 3. UCI 계산 보정
- **`services/uciCompute.js`** 수정
- `computeHumanScore()` 함수에 베이스라인 보정 추가
- **새로운 지표**:
  - `relative_to_baseline`: 서울시 평균 대비 상대값 (가중치 0.20)
  - `excess_growth_rate`: 초과 증가율 (가중치 0.15)

### 4. Action Card 설명 강화
- **`routes/actionCards.js`** 수정
- 베이스라인 비교 문구 자동 생성
- 예: "서울시 평균 대비 1.8배 높은 신고량", "서울시 전체 증가율 대비 35%p 높은 증가"

---

## 🎯 Priority Score 계산식 개선

### Before
```javascript
humanScore = (
  total_complaints * 0.2 +
  odor_ratio * 0.2 +
  trash_ratio * 0.15 +
  ...
)
```

### After
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

## 📊 데이터 현황

```
baseline_metrics: 1,436개
기간: 2012-08 ~ 2025-11
카테고리: 전체, 청소, 환경, 도로, 교통, 주택건축, 가로정비, 보건, 공원녹지
```

---

## 🚀 사용 방법

### 1. 베이스라인 데이터 임포트 (완료)
```bash
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

## ⚠️ 지금 당장 안 해도 되는 것

### Phase 1: 기본 통합 (✅ 완료)
- [x] baseline_metrics 모델
- [x] ETL 스크립트
- [x] UCI 계산 보정
- [x] Action Card 설명 강화

### Phase 2: 고도화 (⏸️ 추후)
- [ ] **계절성 보정**: 데이터가 5개월뿐이라 패턴 파악 불가 → 1년 이상 데이터 축적 후
- [ ] **카테고리 세분화**: 현재는 전체/청소/환경 정도만 → 필요 시 확장
- [ ] **실시간 업데이트**: 월별 자동 업데이트 스크립트 → 필요 시 추가
- [ ] **베이스라인 API**: 내부 계산용으로만 사용 (요구사항에 없음)

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

1. ✅ `npm run etl-baseline` 실행 완료
2. ⏭️ `npm run compute-uci` 재실행 (베이스라인 반영)
3. ⏭️ `npm run priority` 재실행
4. ⏭️ Priority Queue / Action Cards 확인

---

## 📝 참고 문서

- `BASELINE_DATA_INTEGRATION.md`: 상세 설계 문서
- `IMPLEMENTATION_PLAN.md`: 구현 계획
- `models/BaselineMetric.js`: 모델 정의
- `scripts/etl_baseline_metrics.js`: ETL 스크립트

