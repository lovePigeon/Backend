# 프론트엔드 API 가이드

## 데이터 업로드 및 임포트

### 1. CSV 파일 업로드
```bash
POST /api/v1/data/upload
Content-Type: multipart/form-data

Form Data:
- file: CSV 파일
- type: raw | processed | uploads
```

### 2. CSV 데이터 임포트 (MongoDB 저장)
```bash
POST /api/v1/data/import/:type
Content-Type: application/json

Body:
{
  "filename": "signals_human_20260108.csv",
  "type": "raw"
}

Types: human | geo | population | spatial_units
```

## 대시보드 데이터 조회

### 1. 데이터 요약
```bash
GET /api/v1/dashboard/summary?date=2026-01-08&unit_id=11110515
```

응답:
```json
{
  "success": true,
  "date": "2026-01-08",
  "summary": {
    "human_signal": {
      "total_complaints": 150,
      "by_type": { "odor": 50, "trash": 80, "illegal_dump": 20 },
      "average_night_ratio": 0.65,
      "average_repeat_ratio": 0.45
    },
    "geo_signal": { "count": 50, "average_vulnerability": 0.6 },
    "population_signal": {
      "total_population": 100000,
      "night_population": 20000,
      "night_ratio": 0.2
    },
    "uci": {
      "average_score": 65.5,
      "grade_distribution": { "A": 5, "B": 10, "C": 15, "D": 12, "E": 8 }
    }
  }
}
```

### 2. 민원 데이터 (Human Signal) - 실시간/일별
```bash
GET /api/v1/dashboard/human-signal?date=2026-01-08&unit_id=11110515&period=day
```

Period: day | week | month

응답:
```json
{
  "success": true,
  "period": "day",
  "summary": {
    "total_complaints": 25,
    "average_per_day": 25,
    "by_day_of_week": { "0": 5, "1": 3, ... },
    "repeat_count": 8
  },
  "trends": [
    {
      "date": "2026-01-08",
      "total": 25,
      "odor": 8,
      "trash": 12,
      "night_ratio": 0.65,
      "repeat_ratio": 0.45
    }
  ]
}
```

### 3. 지리 공간 데이터 (Geo Signal)
```bash
GET /api/v1/dashboard/geo-signal?unit_id=11110515
```

응답:
```json
{
  "success": true,
  "data": [
    {
      "unit_id": "11110515",
      "alley_density": 65.5,
      "backroad_ratio": 0.6,
      "ventilation_proxy": 5.2,
      "accessibility_proxy": 4.1,
      "landuse_mix": 0.5,
      "vulnerability_score": 0.65
    }
  ]
}
```

### 4. 생활인구 데이터 (Population Signal) - 실시간/일별
```bash
GET /api/v1/dashboard/population-signal?date=2026-01-08&period=day
```

응답:
```json
{
  "success": true,
  "summary": {
    "average_total": 10000,
    "average_night": 2000,
    "average_change_rate": 0.15,
    "trend": "increasing"
  },
  "trends": [
    {
      "date": "2026-01-08",
      "pop_total": 10000,
      "pop_night": 2000,
      "pop_change_rate": 0.15,
      "night_ratio": 0.2
    }
  ]
}
```

### 5. 편의성 지수 (UCI) - 주간/월별/분기별
```bash
GET /api/v1/dashboard/uci?date=2026-01-08&period=week
```

Period: week | month | quarter

응답:
```json
{
  "success": true,
  "period": "week",
  "summary": {
    "average_score": 65.5,
    "grade_distribution": {
      "A": 5, "B": 10, "C": 15, "D": 12, "E": 8
    }
  },
  "trends": [
    {
      "date": "2026-01-08",
      "unit_id": "11110515",
      "uci_score": 75.3,
      "uci_grade": "D",
      "components": { ... },
      "explain": { ... }
    }
  ]
}
```

### 6. 개선 사업 데이터
```bash
GET /api/v1/dashboard/interventions?unit_id=11110515&status=active
```

Status: active | completed | (없으면 전체)

응답:
```json
{
  "success": true,
  "count": 10,
  "active": 5,
  "completed": 5,
  "data": [
    {
      "intervention_id": "...",
      "unit_id": "11110515",
      "intervention_type": "night_cleanup",
      "start_date": "2026-01-01",
      "end_date": null,
      "status": "active",
      "progress": 25,
      "note": "야간 집중 청소 실시"
    }
  ]
}
```

### 7. 개입 이력 및 전후 효과
```bash
GET /api/v1/dashboard/interventions/:intervention_id/effect?baseline_weeks=4&followup_weeks=4
```

응답:
```json
{
  "success": true,
  "intervention": { ... },
  "effect": {
    "baseline_period": {
      "start": "2025-12-04",
      "end": "2025-12-31",
      "average_uci": 80.5,
      "data": [ ... ]
    },
    "followup_period": {
      "start": "2026-01-01",
      "end": "2026-01-29",
      "average_uci": 65.2,
      "data": [ ... ]
    },
    "improvement": 19.0,
    "effect_size": 15.3
  }
}
```

## 데이터 업데이트 주기별 사용 가이드

### 실시간/일별
- `GET /api/v1/dashboard/human-signal?period=day`
- `GET /api/v1/dashboard/population-signal?period=day`

### 주간
- `GET /api/v1/dashboard/uci?period=week`
- `GET /api/v1/dashboard/human-signal?period=week`

### 월별
- `GET /api/v1/dashboard/uci?period=month`
- `GET /api/v1/dashboard/population-signal?period=month`

### 분기별
- `GET /api/v1/dashboard/uci?period=quarter`

### 이벤트 기반
- `GET /api/v1/dashboard/interventions` (개선 사업 진행률)
- `GET /api/v1/dashboard/interventions/:id/effect` (개입 이력)

