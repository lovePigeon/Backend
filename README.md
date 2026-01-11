# 민원냠냠 Core Engine API

공공데이터 기반 **Urban Comfort Index(UCI)** 산출 및 우선순위 추천 백엔드 API

## 핵심 컨셉

민원냠냠은 공개 가능한 도시 데이터로 도시 환경 변화의 초기 신호를 포착하고 행정 자원 투입 우선순위를 추천하는 **Early Warning 의사결정 도구**입니다.

- **Core Engine**: 비둘기 없이 100% 동작
- **Pigeon Layer**: Optional, 해석/보조 검증 신호로만 사용
- **UCI**: 정확한 예측이 아닌 **우선순위 추천** 지표

## 기술 스택

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Cloud)
- **ODM**: Mongoose
- **문서화**: Swagger UI (OpenAPI)
- **기타**: 
  - `csv-parser`: CSV 파일 파싱
  - `xlsx`: Excel 파일 파싱
  - `iconv-lite`: 인코딩 변환 (CP949 → UTF-8)
  - `unzipper`: ZIP 파일 압축 해제
  - `date-fns`: 날짜 처리
  - `dotenv`: 환경변수 관리

## 프로젝트 구조

```
리빙랩/
├── server.js                    # Express 앱 진입점
├── package.json                 # 프로젝트 설정 및 스크립트
├── .env.example                 # 환경변수 예시
├── .gitignore                   # Git 무시 파일
│
├── config/                      # 설정 파일
│   ├── database.js              # MongoDB 연결 및 인덱스
│   ├── settings.js              # UCI 가중치, 등급컷 등 설정
│   └── swagger.js               # Swagger UI 설정
│
├── models/                      # Mongoose 모델 (9개)
│   ├── SpatialUnit.js           # 공간 단위
│   ├── SignalHuman.js           # 민원 신호
│   ├── SignalGeo.js             # 지리 신호
│   ├── SignalPopulation.js      # 생활인구 신호
│   ├── ComfortIndex.js          # UCI 계산 결과
│   ├── BaselineMetric.js        # 베이스라인 지표
│   ├── TimePatternTemplate.js   # 시간 패턴 템플릿
│   ├── CleanupLog.js            # 수거 현황 로그
│   └── Intervention.js          # 행정 조치 이력
│
├── routes/                      # API 라우터 (12개)
│   ├── health.js                # Health Check
│   ├── units.js                 # 공간 단위 조회
│   ├── comfortIndex.js          # UCI 조회 및 계산
│   ├── priority.js              # Priority Queue
│   ├── actionCards.js           # Action Cards
│   ├── dashboard.js             # Dashboard API
│   ├── interventions.js         # 개입 이력
│   ├── geo.js                   # GeoJSON (Mapbox용)
│   ├── uciInfo.js               # UCI 계산 로직 설명
│   ├── data.js                  # 데이터 조회
│   ├── dataImport.js            # 데이터 임포트
│   └── analytics.js             # 분석 API
│
├── services/                    # 비즈니스 로직
│   ├── uciCompute.js            # UCI 계산 로직
│   └── normalization.js         # 정규화 유틸리티
│
├── scripts/                     # ETL 및 유틸리티 스크립트
│   ├── etl_human_signals.js     # 민원 데이터 임포트
│   ├── etl_population_signals.js # 생활인구 데이터 임포트
│   ├── etl_district_complaints.js # 구 단위 민원 데이터 임포트
│   ├── etl_baseline_metrics.js  # 베이스라인 데이터 임포트
│   ├── etl_habitual_dumping_areas.js # 상습지역 데이터 임포트
│   ├── etl_cleanup_logs.js      # 수거 현황 데이터 임포트
│   ├── etl_time_pattern_templates.js # 시간 패턴 템플릿 생성
│   ├── compute_comfort_index.js # UCI 계산
│   ├── update_spatial_unit_names.js # 지역명 업데이트
│   ├── generate_priority_queue.js # Priority Queue 생성
│   ├── generate_blind_spots.js # Blind Spots 생성
│   ├── run_etl_pipeline.js     # 전체 ETL 파이프라인
│   └── check_*.js               # 데이터 확인 스크립트들
│
├── data/                        # 데이터 파일
│   ├── raw/                     # 원본 데이터 (Git 제외)
│   ├── processed/               # 처리된 데이터
│   └── uploads/                 # 업로드된 파일
│
├── tests/                       # 테스트 코드
│   ├── test_uci_compute.py
│   ├── test_priority_queue.py
│   └── test_geojson.py
│
├── docker-compose.yml           # Docker Compose 설정
├── Dockerfile                   # Docker 이미지 설정
└── README.md                    # 이 파일
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
PORT=8000
NODE_ENV=development
```

### 3. 서버 실행

```bash
# 프로덕션 모드
npm start

# 개발 모드 (nodemon)
npm run dev
```

서버 실행 후: http://localhost:8000

### 4. API 문서

Swagger UI: http://localhost:8000/docs

## 데이터 임포트

### ETL 스크립트 실행

```bash
# 민원 데이터
npm run etl

# 생활인구 데이터 (ZIP 파일 지원)
npm run etl-population

# 구 단위 민원 데이터
npm run etl-district

# 베이스라인 데이터
npm run etl-baseline

# 상습지역 데이터
npm run etl-habitual

# 수거 현황 데이터
npm run etl-cleanup

# 시간 패턴 템플릿
npm run etl-time-pattern

# 전체 파이프라인
npm run pipeline
```

### UCI 계산

```bash
# 모든 지역에 대해 UCI 계산
npm run compute-uci

# 또는 API로 계산
POST /api/v1/comfort-index/compute
```

### 유틸리티

```bash
# 지역명 업데이트
npm run update-names

# Priority Queue 생성
npm run priority

# Blind Spots 생성
npm run blind-spots
```

## API 엔드포인트

### Health Check

```bash
GET /api/v1/health
```

### UCI 관련

```bash
# UCI 계산 및 저장
POST /api/v1/comfort-index/compute
{
  "date": "2025-12-01",
  "unit_id": "11110",  # 선택적 (없으면 전체)
  "window_weeks": 4,
  "use_pigeon": false
}

# UCI 조회
GET /api/v1/comfort-index?date=2025-12-01&grade=E&top_k=10
GET /api/v1/comfort-index/{unit_id}?date=2025-12-01

# UCI 계산 로직 설명
GET /api/v1/uci-info
```

### Priority Queue

```bash
GET /api/v1/priority-queue?date=2025-12-01&top_n=20
```

응답 예시:
```json
{
  "rank": 1,
  "unit_id": "11110515",
  "name": "필운동",
  "uci_score": 63.14,
  "uci_grade": "D",
  "status": "high",
  "status_kr": "높음",
  "comfort_index": 36.86,
  "why_summary": "총 민원 1,878건, 서울시 평균 대비 1.2배 높은 신고량",
  "key_drivers": [
    { "signal": "total_complaints", "value": 1878 }
  ]
}
```

### Action Cards

```bash
GET /api/v1/action-cards?date=2025-12-01&unit_id=11110515
POST /api/v1/action-cards/generate
```

### Dashboard

```bash
# 전체 추세
GET /api/v1/dashboard/trends?period=quarter

# 지역별 현황
GET /api/v1/dashboard/regional-trends?date=2025-12-01

# 신호 추세
GET /api/v1/dashboard/human-signal?date=2025-12-01&period=month
GET /api/v1/dashboard/population-signal?date=2025-12-01&period=month

# 개선 현황
GET /api/v1/dashboard/interventions?status=active

# 개입 효과 추적
GET /api/v1/dashboard/interventions/{id}/effect?baseline_weeks=4&followup_weeks=4

# 시간대별 패턴
GET /api/v1/dashboard/time-pattern?unit_id=11110&date=2025-12-01

# 사각지대 탐지
GET /api/v1/dashboard/blind-spots?date=2025-12-01
```

### Interventions

```bash
# 개입 이력 생성
POST /api/v1/interventions
{
  "unit_id": "11110",
  "intervention_type": "night_cleanup",
  "start_date": "2025-12-01",
  "note": "야간 집중 청소"
}

# 개입 이력 조회
GET /api/v1/interventions?unit_id=11110
```

### GeoJSON (Mapbox용)

```bash
GET /api/v1/geo/comfort-index.geojson?date=2025-12-01
```

### Spatial Units

```bash
GET /api/v1/units?q=청운&limit=10
GET /api/v1/units/{unit_id}
GET /api/v1/units/within/geo?lng=126.978&lat=37.566&radius_m=1000
```

## UCI 계산 로직

### 계산 공식

```
UCI = (HumanScore × 0.5) + (GeoScore × 0.3) + (PopulationScore × 0.2) × 100
```

### 신호 그룹

#### 1. Human Signal (가중치 50%)
- 민원 총량 (15%)
- 서울시 평균 대비 상대적 비율 (20%)
- 초과 증가율 (15%)
- 악취/쓰레기/불법투기 비율 (39%)
- 야간 집중도 (11%)

#### 2. Geo Signal (가중치 30%)
- 골목 밀도 (25%)
- 후면 도로 비율 (20%)
- 상습 무단투기 위험도 (20%)
- 환기/접근성 proxy (27%)
- 토지이용 혼합도 (8%)

#### 3. Population Signal (가중치 20%)
- 생활인구 규모 (30%)
- 야간 인구 비중 (40%)
- 인구 증가율 (30%)

### 등급 체계

- **A (0-20점)**: 매우 양호
- **B (20-40점)**: 양호
- **C (40-60점)**: 보통
- **D (60-80점)**: 주의 필요
- **E (80-100점)**: 즉시 조치 필요

**높을수록 위험/불편 신호가 강함**

### 계산 과정

1. 최근 4주간(28일) 데이터 수집
2. 각 신호 그룹별 점수 계산 (0-1 범위로 정규화)
3. 가중치 적용: Human(50%) + Geo(30%) + Population(20%)
4. 최종 점수 계산: 가중합 × 100 (0-100 범위)
5. 등급 부여: A(0-20), B(20-40), C(40-60), D(60-80), E(80-100)

### 특별 기능

- **결측치 처리**: 특정 신호가 없으면 해당 컴포넌트 제외 후 가중치 재정규화
- **베이스라인 비교**: 서울시 평균 대비 상대적 증가율 반영
- **상습지역 가중치**: 상습 무단투기 지역은 geoScore에 20% 가중치 추가
- **이상치 완화**: Winsorize (상하 5%)

## 설정 커스터마이징

`config/settings.js`에서 다음 설정을 변경할 수 있습니다:

```javascript
{
  defaultWindowWeeks: 4,        // 기본 윈도우 주수
  uciWeights: {
    human: 0.5,                 // Human Signal 가중치
    geo: 0.3,                   // Geo Signal 가중치
    population: 0.2,            // Population Signal 가중치
    pigeon: 0.0                 // Pigeon Signal 가중치 (기본 비활성화)
  },
  gradeCutoffs: {
    A: 0.0,   // 0-20
    B: 20.0,  // 20-40
    C: 40.0,  // 40-60
    D: 60.0,  // 60-80
    E: 80.0   // 80-100
  },
  winsorizePercentile: 0.05    // 이상치 완화 퍼센타일
}
```

## 데이터베이스 구조

### MongoDB 컬렉션 (9개)

1. **spatial_units**: 공간 단위 (행정동)
2. **signals_human**: 민원 신호 (일 단위)
3. **signals_geo**: 지리 신호 (정적)
4. **signals_population**: 생활인구 신호 (일 단위)
5. **comfort_index**: UCI 계산 결과
6. **baseline_metrics**: 서울시 전체 평균 민원 데이터
7. **time_pattern_templates**: 시간 패턴 템플릿
8. **cleanup_logs**: 수거 현황 로그
9. **interventions**: 행정 조치 이력

자세한 스키마는 각 모델 파일(`models/*.js`)을 참조하세요.

## 현재 데이터 현황

- **signals_human**: 
  - 행정동 단위: 종로구 23개 지역
  - 구 단위: 서울시 25개 구 × 160개월 = 4,000개 문서
- **signals_population**: 463,856개 문서 (36개월, 424개 지역)
- **comfort_index**: 48개 지역에 대해 계산 완료
- **baseline_metrics**: 서울시 전체 평균 민원 데이터
- **time_pattern_templates**: 전주시 시간 패턴 템플릿
- **cleanup_logs**: 수거 현황 데이터 (ETL 스크립트 준비 완료)

## 주요 기능

### 1. Priority Queue
- UCI 점수가 높은 지역을 우선순위로 정렬
- 각 항목에 `why_summary` (왜 우선인지) 자동 생성
- `key_drivers` (주요 원인) 자동 추출
- 상습지역 정보 포함

### 2. Action Cards
- 데이터 기반 행정 조치 권고 생성
- 시간 패턴 템플릿 기반 시간대별 권고
- 베이스라인 비교 기반 설명

### 3. Effect Tracking
- 개입 전후 UCI 변화 추적
- 수거 현황 데이터 연결 (Before/After 비교)
- 개선 효과 정량화

### 4. Blind Spots Detection
- 신호 간 불일치 분석
- 행정 데이터가 놓치는 사각지대 탐지

## 주의사항

1. **UCI는 우선순위 추천 도구**: 정확한 예측이 아닌 행정 자원 투입 우선순위를 제안합니다.
2. **비둘기 신호는 옵션**: Core Engine은 비둘기 없이 동작합니다.
3. **설정 분리**: 모든 가중치/등급컷/윈도우는 config로 분리되어 있습니다.
4. **대용량 데이터**: `data/raw/` 폴더의 파일들은 Git에 포함되지 않습니다 (`.gitignore` 참조).

## 참고 문서

- `PROJECT_SUMMARY.md`: 프로젝트 전체 요약
- `PRESENTATION_BACKEND.md`: 백엔드 작업 보고서
- `FRONTEND_ENDPOINTS_GUIDE.md`: 프론트엔드 API 가이드
- `ETL_PIPELINE_GUIDE.md`: ETL 파이프라인 가이드
- `INTEGRATION_STATUS.md`: 데이터 통합 상태

## 라이선스

ISC
