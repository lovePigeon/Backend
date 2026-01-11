# 3가지 데이터 통합 구현 가이드

## 📋 구현 완료 사항

### 1. 모델 생성 ✅
- ✅ `models/CleanupLog.js` - 수거 현황 데이터
- ✅ `models/TimePatternTemplate.js` - 시간 패턴 템플릿
- ✅ `models/SignalGeo.js` - 상습지역 필드 추가

### 2. ETL 스크립트 생성 ✅
- ✅ `scripts/etl_habitual_dumping_areas.js` - 상습지역 데이터
- ✅ `scripts/etl_cleanup_logs.js` - 수거 현황 데이터
- ✅ `scripts/etl_time_pattern_templates.js` - 시간 패턴 템플릿

### 3. 연결 및 통합 ✅
- ✅ Priority Queue: 상습지역 가중치 반영 (`routes/priority.js`)
- ✅ Action Card: 시간 패턴 템플릿 적용 (`routes/actionCards.js`)
- ✅ Effect Tracking: 수거 현황 데이터 연결 (`routes/dashboard.js`)
- ✅ UCI 계산: 상습지역 위험도 반영 (`services/uciCompute.js`)

---

## 🚀 사용 방법

### 1. 상습지역 데이터 임포트
```bash
npm run etl-habitual
```

**결과**:
- `signals_geo` 컬렉션에 `habitual_dumping_risk`, `habitual_dumping_count`, `habitual_dumping_locations` 필드 추가
- Priority Queue에서 상습지역 정보 표시

### 2. 수거 현황 데이터 임포트
```bash
npm run etl-cleanup
```

**결과**:
- `cleanup_logs` 컬렉션에 수거 현황 저장
- Before/After Tracking에서 수거율 변화 확인 가능

### 3. 시간 패턴 템플릿 생성
```bash
npm run etl-time-pattern
```

**결과**:
- `time_pattern_templates` 컬렉션에 시간 패턴 저장
- Action Card에서 시간 기반 권고 생성

### 4. UCI 재계산 (상습지역 반영)
```bash
npm run compute-uci
```

**결과**:
- `signals_geo.habitual_dumping_risk`가 UCI 계산에 반영
- 상습지역은 geoScore에 20% 가중치 추가

---

## 📊 데이터 흐름

### Priority Queue
```
상습지역 데이터 (signals_geo)
    ↓
UCI 계산 시 geoScore에 가중치 추가
    ↓
Priority Queue 정렬
    ↓
why_summary에 상습지역 정보 포함
```

### Action Card
```
전주시 시간 패턴 템플릿 (time_pattern_templates)
    ↓
Action Card 생성 시 템플릿 조회
    ↓
시간 패턴 비교 (night_ratio, weekend_ratio, peak_hours)
    ↓
시간 기반 권고 생성
```

### Effect Tracking
```
수거 현황 데이터 (cleanup_logs)
    ↓
interventions와 연결
    ↓
Before/After 비교
    ↓
수거율 변화 반환
```

---

## 🎯 핵심 원칙

1. **역할 분리**: 각 데이터는 서로를 대체하지 않고 조합됨
2. **템플릿 기반**: 전주시 데이터는 예측용이 아닌 패턴 레퍼런스
3. **공간 우선순위**: 상습지역 데이터는 공간 후보군으로만 사용
4. **효과 검증**: 수거 현황은 Before/After Tracking에만 사용

---

## 📝 다음 단계

1. 실제 CSV/XLSX 파일 구조 확인 및 ETL 스크립트 수정
2. 주소/좌표 매핑 로직 구현 (geocoding 또는 매핑 테이블)
3. 테스트 및 검증

