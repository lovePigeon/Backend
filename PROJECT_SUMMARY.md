# 민원냠냠 Core Engine 프로젝트 요약

## 📋 프로젝트 개요

**프로젝트명**: 민원냠냠 Core Engine  
**목표**: 도시 환경 문제를 조기에 감지하고, 행정 자원을 어디에 먼저 투입할지 우선순위를 제안하는 Early Warning 의사결정 도구

**핵심 컨셉**:
- 공개 가능한 도시 데이터로 도시 환경 변화의 초기 신호를 포착
- 행정 자원 투입 우선순위 추천 도구 (예측 ❌ / 우선순위 판단 ⭕)
- 비둘기 데이터는 optional (없어도 모든 기능 동작)

---

## 🛠️ 기술 스택

- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas
- **ODM**: Mongoose
- **문서화**: Swagger UI (OpenAPI)
- **기타**: 
  - `csv-parser`: CSV 파일 파싱
  - `xlsx`: Excel 파일 파싱
  - `date-fns`: 날짜 처리
  - `dotenv`: 환경변수 관리

---

## 🗄️ MongoDB 컬렉션 설계

### 1. spatial_units
- **역할**: 공간 단위 (행정동)
- **필드**: `_id` (unit_id), `name`, `geom` (GeoJSON), `meta`
- **인덱스**: `geom` (2dsphere), `name` (1)

### 2. signals_human
- **역할**: 민원 기반 신호 (일 단위)
- **필드**: `unit_id`, `date`, `signal_type` (total/odor/trash/illegal_dumping/night_ratio/repeat_ratio), `value`, `meta`
- **인덱스**: `{ unit_id: 1, date: 1, signal_type: 1 }` (unique)

### 3. signals_geo
- **역할**: 공간 취약성 신호 (정적)
- **필드**: `_id` (unit_id), `alley_density`, `backroad_ratio`, `ventilation_proxy`, `accessibility_proxy`, `landuse_mix`, `habitual_dumping_risk`, `habitual_dumping_count`, `habitual_dumping_locations`
- **인덱스**: `_id` (기본)

### 4. signals_population
- **역할**: 생활인구 신호 (일 단위)
- **필드**: `unit_id`, `date`, `pop_total`, `pop_night`, `pop_change_rate`, `source`, `raw`
- **인덱스**: `{ unit_id: 1, date: 1 }` (unique)

### 5. comfort_index
- **역할**: Urban Comfort Index (UCI) 계산 결과
- **필드**: `unit_id`, `date`, `uci_score` (0-100), `uci_grade` (A-E), `components`, `explain` (why_summary, key_drivers), `created_at`
- **인덱스**: `{ unit_id: 1, date: 1 }` (unique), `{ date: 1, uci_score: -1 }`

### 6. baseline_metrics
- **역할**: 서울시 전체 평균 민원 데이터 (베이스라인)
- **필드**: `period` (YYYY-MM), `category`, `citywide_total`, `citywide_avg_per_unit`, `growth_rate`, `source`, `meta`
- **인덱스**: `{ period: 1, category: 1 }` (unique)

### 7. time_pattern_templates
- **역할**: 시간 패턴 템플릿 (전주시 데이터 기반)
- **필드**: `pattern_type`, `violation_type`, `time_pattern` (hour_distribution, day_of_week_distribution, night_ratio, weekend_ratio, peak_hours, peak_days), `sample_size`, `source`
- **인덱스**: `{ pattern_type: 1, violation_type: 1 }`

### 8. cleanup_logs
- **역할**: 쓰레기 수거 현황 로그 (Before/After Tracking용)
- **필드**: `unit_id`, `date`, `cleanup_type`, `collection_amount`, `collection_rate`, `processing_method`, `population_rate`, `source`, `meta`
- **인덱스**: `{ unit_id: 1, date: -1 }`, `{ date: -1 }`

### 9. interventions
- **역할**: 행정 조치 이력
- **필드**: `unit_id`, `intervention_type`, `start_date`, `end_date`, `note`, `created_by`, `meta`, `created_at`
- **인덱스**: `{ unit_id: 1, start_date: -1 }`

---

## 🎯 Urban Comfort Index (UCI) 로직

### 계산 방식
- **입력 신호**: Human-signal, Geo-signal, Population-signal (Pigeon-signal은 optional)
- **윈도우**: 최근 4주 (rolling aggregation)
- **정규화**: 각 신호를 0-1로 스케일
- **가중치**: Human 0.5, Geo 0.3, Population 0.2 (Pigeon 0.0, optional 0.1-0.2)
- **등급**: A(0-20), B(20-40), C(40-60), D(60-80), E(80-100)

### 특별 기능
- **결측치 처리**: 특정 컴포넌트가 없으면 제외하고 가중치 재정규화
- **베이스라인 비교**: 서울시 평균 대비 상대적 증가율 반영
- **상습지역 가중치**: `habitual_dumping_risk`가 geoScore에 20% 가중치 추가

---

## 📊 데이터 통합 (3가지 신규 데이터)

### 1️⃣ 서울특별시 강남구_쓰레기상습무단투기지역현황
- **역할**: 공간 후보군 데이터 (어디를 먼저 볼 것인가)
- **저장 위치**: `signals_geo` (habitual_dumping_risk, habitual_dumping_count, habitual_dumping_locations)
- **활용**: Priority Queue 우선순위 강화, UCI 계산 시 geoScore 가중치 추가

### 2️⃣ 서울특별시 강남구_쓰레기수거+현황
- **역할**: 개입 정보 및 Before/After 효과 추적
- **저장 위치**: `cleanup_logs`
- **활용**: Effect Tracking에서 수거율 변화 확인

### 3️⃣ 전북특별자치도 전주시_쓰레기 불법투기 단속현황
- **역할**: 시간 패턴 템플릿 데이터 (언제 문제되는가)
- **저장 위치**: `time_pattern_templates`
- **활용**: Action Card에서 시간 기반 권고 생성 (야간/주말 집중 관리 등)

---

## 🔧 ETL 스크립트

### 구현된 스크립트
1. `scripts/etl_human_signals.js` - 민원 데이터 임포트
2. `scripts/etl_baseline_metrics.js` - 서울시 평균 민원 데이터 임포트
3. `scripts/etl_population_signals.js` - 생활인구 데이터 임포트 (ZIP 파일 지원)
4. `scripts/etl_habitual_dumping_areas.js` - 상습지역 데이터 임포트
5. `scripts/etl_cleanup_logs.js` - 수거 현황 데이터 임포트
6. `scripts/etl_time_pattern_templates.js` - 시간 패턴 템플릿 생성
7. `scripts/compute_comfort_index.js` - UCI 계산
8. `scripts/update_spatial_unit_names.js` - 지역명 업데이트

### 실행 명령어
```bash
npm run etl              # 민원 데이터 임포트
npm run etl-baseline     # 베이스라인 데이터 임포트
npm run etl-population   # 생활인구 데이터 임포트
npm run etl-habitual     # 상습지역 데이터 임포트
npm run etl-cleanup      # 수거 현황 데이터 임포트
npm run etl-time-pattern # 시간 패턴 템플릿 생성
npm run compute-uci      # UCI 계산
npm run update-names     # 지역명 업데이트
```

---

## 🔌 API 엔드포인트

### Health Check
- `GET /api/v1/health` - 서버 상태 확인

### Spatial Units
- `GET /api/v1/units` - 공간 단위 목록 조회
- `GET /api/v1/units/{unit_id}` - 공간 단위 상세 조회
- `GET /api/v1/units/within/geo` - 특정 위치 기준 공간 단위 조회

### Comfort Index
- `GET /api/v1/comfort-index` - UCI 목록 조회
- `GET /api/v1/comfort-index/{unit_id}` - 특정 지역 UCI 조회

### Priority Queue
- `GET /api/v1/priority-queue` - 우선순위 대기열 조회 (UCI 점수 높은 순)

### Action Cards
- `GET /api/v1/action-cards` - Action Cards 조회

### Dashboard
- `GET /api/v1/dashboard/trends` - 전체 추세 지표
- `GET /api/v1/dashboard/uci` - UCI 지수
- `GET /api/v1/dashboard/regional-trends` - 지역별 현황
- `GET /api/v1/dashboard/human-signal` - 인간 신호
- `GET /api/v1/dashboard/population-signal` - 생활인구 신호
- `GET /api/v1/dashboard/interventions` - 개선 현황
- `GET /api/v1/dashboard/interventions/{id}/effect` - 개입 효과 추적
- `GET /api/v1/dashboard/time-pattern` - 시간대별 패턴 분석
- `GET /api/v1/dashboard/blind-spots` - 사각지대 탐지

### Interventions
- `POST /api/v1/interventions` - 개입 이력 생성

### GeoJSON
- `GET /api/v1/geo/comfort-index.geojson` - UCI GeoJSON (Mapbox용)

### API 문서
- `GET /docs` - Swagger UI (OpenAPI 문서)

---

## 📈 현재 데이터 현황

### signals_human
- 총 문서 수: 46개
- 날짜 범위: 1999-01-01 ~ 2023-01-01
- 소스: CSV 임포트

### signals_population
- 총 문서 수: 463,856개
- 날짜 범위: 2023-01-01 ~ 2025-12-31
- 처리된 월 수: 36개월 (2023년 1월 ~ 2025년 12월)
- 지역 수: 424개
- 소스: 서울시 생활인구 데이터 (ZIP 파일 35개 + CSV 1개)

### signals_geo
- 상습지역 데이터: 일부 지역에 `habitual_dumping_risk` 필드 추가
- 소스: 서울특별시 강남구_쓰레기상습무단투기지역현황

### baseline_metrics
- 서울시 전체 평균 민원 데이터 저장
- 소스: 서울시 스마트 불편신고 분야별 신고 현황

### time_pattern_templates
- 전주시 시간 패턴 템플릿 저장
- 소스: 전북특별자치도 전주시_쓰레기 불법투기 단속현황

### cleanup_logs
- 현재 데이터 없음 (ETL 스크립트 준비 완료)

### spatial_units
- 총 37개 지역
- 지역명: 모두 실제 이름으로 업데이트 완료 (청운효자동, 사직동, 수송동 등)

---

## 🎯 주요 기능

### 1. Priority Queue
- UCI 점수가 높은 지역을 우선순위로 정렬
- 상습지역 정보 포함 (`habitual_dumping_risk`)
- `why_summary` 및 `key_drivers` 자동 생성

### 2. Action Cards
- 시간 패턴 템플릿 기반 권고 생성
- 야간/주말 집중 관리 권고
- 베이스라인 비교 기반 설명

### 3. Effect Tracking
- 개입 전후 UCI 변화 추적
- 수거 현황 데이터 연결 (cleanup_logs)
- Before/After 비교

### 4. Blind Spots Detection
- 신호 간 불일치 분석
- 행정 데이터가 놓치는 사각지대 탐지

---

## 🔗 코드 구조

```
/
├── server.js                 # Express 서버 메인
├── config/
│   ├── database.js          # MongoDB 연결
│   └── settings.js          # UCI 가중치 등 설정
├── models/                  # Mongoose 모델
│   ├── SpatialUnit.js
│   ├── SignalHuman.js
│   ├── SignalGeo.js
│   ├── SignalPopulation.js
│   ├── ComfortIndex.js
│   ├── BaselineMetric.js
│   ├── TimePatternTemplate.js
│   ├── CleanupLog.js
│   └── Intervention.js
├── routes/                  # API 라우터
│   ├── health.js
│   ├── units.js
│   ├── comfortIndex.js
│   ├── priority.js
│   ├── actionCards.js
│   ├── dashboard.js
│   ├── interventions.js
│   └── geo.js
├── services/                # 비즈니스 로직
│   └── uciCompute.js        # UCI 계산 로직
└── scripts/                 # ETL 스크립트
    ├── etl_human_signals.js
    ├── etl_population_signals.js
    ├── etl_baseline_metrics.js
    ├── etl_habitual_dumping_areas.js
    ├── etl_cleanup_logs.js
    ├── etl_time_pattern_templates.js
    ├── compute_comfort_index.js
    └── update_spatial_unit_names.js
```

---

## ✅ 구현 완료 사항

### Phase 1: 기본 구조
- ✅ Express 서버 설정
- ✅ MongoDB Atlas 연결
- ✅ Swagger UI 문서화
- ✅ 기본 모델 및 스키마 생성

### Phase 2: 데이터 임포트
- ✅ 민원 데이터 ETL 스크립트
- ✅ 생활인구 데이터 ETL 스크립트 (ZIP 파일 지원)
- ✅ 베이스라인 데이터 ETL 스크립트
- ✅ 지역명 매핑 및 업데이트

### Phase 3: UCI 계산
- ✅ UCI 계산 로직 구현
- ✅ 베이스라인 비교 기능
- ✅ 상습지역 가중치 반영

### Phase 4: 3가지 데이터 통합
- ✅ 상습지역 데이터 통합 (signals_geo 확장)
- ✅ 수거 현황 데이터 통합 (cleanup_logs 생성)
- ✅ 시간 패턴 템플릿 통합 (time_pattern_templates 생성)

### Phase 5: API 연결
- ✅ Priority Queue에 상습지역 정보 추가
- ✅ Action Card에 시간 패턴 템플릿 적용
- ✅ Effect Tracking에 수거 현황 데이터 연결

---

## 📝 주요 해결 사항

### 1. 지역명 숫자 표시 문제
- **문제**: 지역명이 "지역1", "지역32" 형식으로 표시
- **해결**: 행정동 코드 매핑 테이블 생성 및 업데이트 스크립트 작성
- **결과**: 모든 37개 지역명을 실제 이름으로 업데이트 완료

### 2. signals_population 컬렉션 비어있음
- **문제**: 생활인구 데이터 파일이 ZIP 형식
- **해결**: ETL 스크립트에 ZIP 파일 압축 해제 기능 추가
- **결과**: 36개 파일 (35개 ZIP + 1개 CSV) 모두 처리 완료, 463,856개 문서 저장

### 3. Priority Queue key_drivers 비어있음
- **문제**: 조건이 너무 엄격하여 key_drivers가 생성되지 않음
- **해결**: 조건 완화 및 total_complaints 항상 포함 로직 추가

### 4. Priority Queue why_summary 일반화
- **문제**: why_summary가 항상 "최근 4주간 신호 분석"으로 표시
- **해결**: 베이스라인 비교 기반 구체적 설명 생성 로직 추가

---

## 🚀 실행 방법

### 환경 변수 설정
```bash
# .env 파일
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
PORT=8000
```

### 서버 실행
```bash
npm install
npm start          # 프로덕션 모드
npm run dev        # 개발 모드 (nodemon)
```

### 데이터 임포트
```bash
npm run etl                # 민원 데이터
npm run etl-population     # 생활인구 데이터
npm run etl-baseline       # 베이스라인 데이터
npm run compute-uci        # UCI 계산
```

### API 문서
- URL: `http://localhost:8000/docs`
- Swagger UI로 모든 API 엔드포인트 확인 가능

---

## 📌 핵심 원칙

1. **역할 분리**: 각 데이터는 서로를 대체하지 않고 조합됨
2. **템플릿 기반**: 전주시 데이터는 예측용이 아닌 패턴 레퍼런스
3. **공간 우선순위**: 상습지역 데이터는 공간 후보군으로만 사용
4. **효과 검증**: 수거 현황은 Before/After Tracking에만 사용
5. **프론트엔드 중심**: 프론트엔드에서 사용하는 API만 제공

---

## 📊 데이터 흐름

```
Raw Data (CSV/XLSX/ZIP)
    ↓
ETL Scripts
    ↓
MongoDB Collections
    ↓
UCI Calculation
    ↓
Priority Queue / Action Cards / Effect Tracking
    ↓
API Responses
```

---

## 🎯 다음 단계 (선택사항)

1. **데이터 추가**
   - signals_geo 데이터 보완
   - cleanup_logs 데이터 임포트
   - 더 많은 월의 생활인구 데이터

2. **기능 강화**
   - 개입 입력 UI 연동
   - 실시간 데이터 업데이트
   - 성능 최적화

3. **테스트**
   - 단위 테스트 작성
   - 통합 테스트 작성
   - 성능 테스트

---

## 📚 참고 문서

- `INTEGRATION_STATUS.md` - 3가지 데이터 통합 상태
- `IMPLEMENTATION_GUIDE.md` - 구현 가이드
- `DATA_INTEGRATION_DESIGN.md` - 데이터 통합 설계
- `package.json` - 프로젝트 설정 및 스크립트

---

**작성일**: 2026-01-11  
**프로젝트 상태**: ✅ 기본 기능 구현 완료  
**데이터 상태**: ✅ 생활인구 데이터 임포트 완료 (36개월)

