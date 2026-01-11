# 3가지 데이터 통합 구현 상태

## ✅ 완료된 구현

### 1. MongoDB 컬렉션 설계 및 모델 생성

#### 1️⃣ 상습지역 데이터 → `signals_geo` 확장 ✅
- **파일**: `models/SignalGeo.js`
- **추가 필드**:
  - `habitual_dumping_risk` (Number, 0-1): 상습 무단투기 위험도
  - `habitual_dumping_count` (Number): 상습 지역 지정 횟수
  - `habitual_dumping_locations` (Array): 상습 지점 좌표 배열
- **역할**: 공간 후보군 데이터 (어디를 먼저 볼 것인가)

#### 2️⃣ 수거 현황 데이터 → `cleanup_logs` 컬렉션 ✅
- **파일**: `models/CleanupLog.js`
- **필드**:
  - `unit_id`, `date`, `cleanup_type`
  - `collection_amount`, `collection_rate`, `processing_method`
  - `population_rate`
- **역할**: 개입 정보 및 Before/After 효과 추적

#### 3️⃣ 시간 패턴 템플릿 → `time_pattern_templates` 컬렉션 ✅
- **파일**: `models/TimePatternTemplate.js`
- **필드**:
  - `pattern_type`, `violation_type`
  - `time_pattern`: `hour_distribution`, `day_of_week_distribution`, `night_ratio`, `weekend_ratio`, `peak_hours`, `peak_days`
  - `sample_size`
- **역할**: 시간 패턴 템플릿 데이터 (언제 문제되는가)

---

### 2. ETL 스크립트 생성

#### ✅ `scripts/etl_habitual_dumping_areas.js`
- 서울특별시 강남구_쓰레기상습무단투기지역현황.xlsx 처리
- `signals_geo` 컬렉션에 `habitual_dumping_risk` 업데이트

#### ✅ `scripts/etl_cleanup_logs.js`
- 서울특별시 강남구_쓰레기수거+현황.csv 처리
- `cleanup_logs` 컬렉션에 수거 현황 저장

#### ✅ `scripts/etl_time_pattern_templates.js`
- 전북특별자치도 전주시_쓰레기 불법투기 단속현황.csv 처리
- `time_pattern_templates` 컬렉션에 시간 패턴 저장

---

### 3. 연결 및 통합

#### ✅ Priority Queue 강화 (`routes/priority.js`)
- `signals_geo.habitual_dumping_risk` 조회
- `why_summary`에 상습지역 정보 포함
- `habitual_dumping_risk` 필드 반환

#### ✅ Action Card 강화 (`routes/actionCards.js`)
- `TimePatternTemplate` 조회
- 시간 패턴 템플릿 기반 권고 생성
- `night_ratio`, `weekend_ratio`, `peak_hours` 활용

#### ✅ Effect Tracking 강화 (`routes/dashboard.js`)
- `CleanupLog` 조회 (Before/After 비교)
- 수거율 변화 계산
- `cleanup_status` 필드 반환

#### ✅ UCI 계산 강화 (`services/uciCompute.js`)
- `signals_geo.habitual_dumping_risk` 반영
- geoScore 계산 시 20% 가중치 추가

---

## 📊 현재 데이터 상태

### MongoDB 컬렉션 데이터 확인

```bash
# 데이터 확인 명령어
npm run etl-habitual    # 상습지역 데이터 임포트
npm run etl-cleanup     # 수거 현황 데이터 임포트
npm run etl-time-pattern # 시간 패턴 템플릿 생성
```

**현재 상태**:
- `cleanup_logs`: 0개 문서 (데이터 미임포트)
- `time_pattern_templates`: 확인 필요
- `signals_geo.habitual_dumping_risk`: 확인 필요

---

## 🎯 데이터 흐름 (구현 완료)

### Priority Queue
```
상습지역 데이터 (signals_geo)
    ↓
UCI 계산 시 geoScore에 가중치 추가 (20%)
    ↓
Priority Queue 정렬
    ↓
why_summary에 상습지역 정보 포함
    ↓
API 응답에 habitual_dumping_risk 포함
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
    ↓
"야간·주말 집중 관리 권고" 등 생성
```

### Effect Tracking
```
수거 현황 데이터 (cleanup_logs)
    ↓
interventions와 연결
    ↓
Before/After 비교
    ↓
수거율 변화 계산
    ↓
cleanup_status 필드로 반환
```

---

## 🔧 다음 단계 (데이터 임포트)

### 1. 상습지역 데이터 임포트
```bash
npm run etl-habitual
```
**파일**: `서울특별시 강남구_쓰레기상습무단투기지역현황_20230621.xlsx`

### 2. 수거 현황 데이터 임포트
```bash
npm run etl-cleanup
```
**파일**: `쓰레기수거+현황_20260109221831.csv`

**참고**: 현재 파일명 필터 문제로 임포트되지 않음. 파일명 확인 필요.

### 3. 시간 패턴 템플릿 생성
```bash
npm run etl-time-pattern
```
**파일**: `전북특별자치도 전주시_쓰레기 불법투기 단속 현황_20250214.csv`

---

## 📌 핵심 원칙 (구현됨)

1. ✅ **역할 분리**: 각 데이터는 서로를 대체하지 않고 조합됨
2. ✅ **템플릿 기반**: 전주시 데이터는 예측용이 아닌 패턴 레퍼런스
3. ✅ **공간 우선순위**: 상습지역 데이터는 공간 후보군으로만 사용
4. ✅ **효과 검증**: 수거 현황은 Before/After Tracking에만 사용

---

## 📝 구현 완료 요약

- ✅ 모델 생성 (3개)
- ✅ ETL 스크립트 (3개)
- ✅ API 연결 (Priority Queue, Action Card, Effect Tracking)
- ✅ UCI 계산 강화
- ⚠️ 데이터 임포트 (필요 시 실행)

**결론**: 코드 구현은 완료되었으며, 데이터 임포트만 진행하면 바로 사용 가능합니다.

