# 민원냠냠 Core Engine API

공공데이터 기반 **Urban Comfort Index(UCI)** 산출 및 우선순위 추천 백엔드 API

## 핵심 컨셉

민원냠냠은 공개 가능한 도시 데이터로 도시 환경 변화의 초기 신호를 포착하고 행정 자원 투입 우선순위를 추천하는 **Early Warning 의사결정 도구**입니다.

- **Core Engine**: 비둘기 없이 100% 동작
- **Pigeon Layer**: Optional, 해석/보조 검증 신호로만 사용
- **UCI**: 정확한 예측이 아닌 **우선순위 추천** 지표

## 기술 스택

- Node.js 20+
- Express.js
- MongoDB (Mongoose)
- Docker + docker-compose

## 프로젝트 구조

```
리빙랩/
├── server.js                 # Express 앱 진입점
├── config/
│   ├── database.js          # MongoDB 연결 및 인덱스
│   └── settings.js          # 설정 (가중치, 등급컷 등)
├── models/                  # Mongoose 모델
├── routes/                  # API 라우트
├── services/                # 비즈니스 로직
│   ├── uciCompute.js       # UCI 계산 로직
│   └── normalization.js    # 정규화 유틸리티
├── scripts/
│   └── seed_demo_data.js    # 더미 데이터 시드
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```env
MONGODB_URI=mongodb://localhost:27017/living_lab
PORT=8000
NODE_ENV=development
```

### 3. Docker Compose로 실행 (권장)

```bash
# MongoDB + API 동시 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 중지
docker-compose down
```

### 4. 로컬 실행

```bash
# MongoDB만 Docker로 실행
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Node.js 서버 실행
npm run dev
```

서버 실행 후: http://localhost:8000

## 더미 데이터 시드

```bash
# Docker Compose 사용 시
docker-compose exec api npm run seed

# 또는 로컬 실행 시
node scripts/seed_demo_data.js
```

50개 spatial units와 8주치 신호 데이터가 생성됩니다.

## API 엔드포인트

### Health Check

```bash
GET /api/v1/health
```

### Spatial Units

```bash
GET /api/v1/units?q=청운&limit=10
GET /api/v1/units/{unit_id}
GET /api/v1/units/within/geo?lng=126.978&lat=37.566&radius_m=1000
POST /api/v1/units
```

### Comfort Index (UCI)

```bash
# UCI 계산 및 저장
POST /api/v1/comfort-index/compute
{
  "date": "2026-01-08",
  "window_weeks": 4,
  "use_pigeon": false
}

# UCI 조회
GET /api/v1/comfort-index?date=2026-01-08&grade=E&top_k=10
GET /api/v1/comfort-index/{unit_id}?date=2026-01-08
```

### Priority Queue

```bash
GET /api/v1/priority-queue?date=2026-01-08&top_n=20
```

### Action Cards

```bash
POST /api/v1/action-cards/generate
{
  "date": "2026-01-08",
  "unit_ids": ["11110515"],
  "use_pigeon": false
}

GET /api/v1/action-cards?date=2026-01-08&unit_id=11110515
```

### Interventions & Tracking

```bash
POST /api/v1/interventions
GET /api/v1/interventions?unit_id=11110515
GET /api/v1/interventions/{intervention_id}/tracking?baseline_weeks=4&followup_weeks=4
```

### GeoJSON (Mapbox용)

```bash
GET /api/v1/geo/comfort-index.geojson?date=2026-01-08
GET /api/v1/geo/priority.geojson?date=2026-01-08&top_n=20
```

## UCI 계산 로직

### 신호 그룹

1. **Human Signal** (가중치 0.5)
   - 민원 총량/증가율
   - 야간 집중도
   - 반복 신고 비율

2. **Geo Signal** (가중치 0.3)
   - 골목 밀도
   - 후면 도로 비율
   - 환기/접근성 proxy

3. **Population Signal** (가중치 0.2)
   - 생활인구 규모
   - 야간 인구 비중
   - 인구 증가율

4. **Pigeon Signal** (가중치 0.0, 옵션)

### 정규화 및 등급

- 이상치 완화: Winsorize (상하 5%)
- 정규화: Min-Max
- 등급: A(0-20), B(20-40), C(40-60), D(60-80), E(80-100)
  - **높을수록 위험/불편 신호 강함**

## 설정 커스터마이징

`config/settings.js`에서 다음 설정을 변경할 수 있습니다:

- `defaultWindowWeeks`: 기본 윈도우 주수 (기본값: 4)
- `uciWeights`: 신호 그룹 가중치
- `gradeCutoffs`: 등급 컷오프 점수
- `winsorizePercentile`: 이상치 완화 퍼센타일

## 주의사항

1. **UCI는 우선순위 추천 도구**: 정확한 예측이 아닌 행정 자원 투입 우선순위를 제안합니다.
2. **비둘기 신호는 옵션**: Core Engine은 비둘기 없이 동작합니다.
3. **설정 분리**: 모든 가중치/등급컷/윈도우는 config로 분리되어 있습니다.
