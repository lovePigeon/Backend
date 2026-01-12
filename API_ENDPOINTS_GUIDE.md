# 민원냠냠 Core Engine API 엔드포인트 가이드

## 📋 개요
이 문서는 프론트엔드 개발을 위한 모든 API 엔드포인트를 정리한 문서입니다.

**Base URL**: `http://localhost:8000/api/v1`

**API 문서**: `http://localhost:8000/docs` (Swagger UI)

---

## 🔍 목차
1. [Health Check](#1-health-check)
2. [Comfort Index (UCI)](#2-comfort-index-uci)
3. [Priority Queue](#3-priority-queue)
4. [Action Cards](#4-action-cards)
5. [Dashboard](#5-dashboard)
6. [GeoJSON](#6-geojson)
7. [Interventions](#7-interventions)
8. [UCI Info](#8-uci-info)
9. [Anomaly Detection (AI)](#9-anomaly-detection-ai)
10. [Analytics](#10-analytics)
11. [Data Management](#11-data-management)
12. [Spatial Units](#12-spatial-units)

---

## 1. Health Check

### `GET /health`
서버 및 데이터베이스 연결 상태 확인

**Response:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 2. Comfort Index (UCI)

### `GET /comfort-index`
편의성 지수 목록 조회

**Query Parameters:**
- `date` (string, optional): 날짜 (YYYY-MM-DD). 없으면 최신 날짜 사용
- `grade` (string, optional): 등급 필터 (A, B, C, D, E)
- `top_k` (integer, optional): 상위 K개만 반환

**Response:**
```json
[
  {
    "unit_id": "11110515",
    "date": "2025-12-01",
    "uci_score": 78.2,
    "uci_grade": "D",
    "components": {
      "human_score": 0.65,
      "geo_score": 0.55,
      "population_score": 0.45
    },
    "explain": {
      "why_summary": "최근 4주 악취 민원 +38%, 야간 집중도 0.72",
      "key_drivers": [
        {
          "signal": "complaint_odor_growth",
          "value": 0.83
        }
      ]
    }
  }
]
```

### `GET /comfort-index/{unit_id}`
특정 지역의 편의성 지수 조회

**Path Parameters:**
- `unit_id` (string, required): 지역 ID

**Query Parameters:**
- `date` (string, optional): 날짜 (없으면 최신)

**Response:**
```json
{
  "unit_id": "11110515",
  "date": "2025-12-01",
  "uci_score": 78.2,
  "uci_grade": "D",
  "components": { ... },
  "explain": { ... },
  "anomaly": {
    "anomaly_score": 0.85,
    "anomaly_flag": true,
    "explanation": "최근 4주 민원이 45% 증가"
  }
}
```

### `POST /comfort-index/compute`
UCI 계산 및 저장

**Request Body:**
```json
{
  "date": "2025-12-01",
  "unit_id": "11110515",
  "window_weeks": 4,
  "use_pigeon": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "UCI 계산 완료",
  "date": "2025-12-01",
  "computed_count": 48,
  "failed_count": 0
}
```

---

## 3. Priority Queue

### `GET /priority-queue`
우선순위 대기열 조회 (UCI 점수 높은 순)

**Query Parameters:**
- `date` (string, required): 날짜 (YYYY-MM-DD)
- `top_n` (integer, optional, default: 20): 상위 N개 (1-100)

**Response:**
```json
[
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
      {
        "signal": "total_complaints",
        "value": 1878
      }
    ],
    "habitual_dumping_risk": 0.75,
    "anomaly_score": 0.85,
    "anomaly_flag": true,
    "anomaly_explanation": "최근 4주 민원이 45% 증가, 통계적 이상치 감지"
  }
]
```

**참고:**
- `status`: `"low"` | `"medium"` | `"high"` (영어)
- `status_kr`: `"낮음"` | `"보통"` | `"높음"` (한국어)
- `comfort_index`: 편의성 지수 (100 - UCI, 높을수록 좋음)
- `uci_score`: UCI 점수 (0-100, 높을수록 위험)

---

## 4. Action Cards

### `GET /action-cards`
조치 권고사항 조회

**Query Parameters:**
- `date` (string, required): 날짜 (YYYY-MM-DD)
- `unit_id` (string, optional): 특정 지역만 조회

**Response:**
```json
[
  {
    "card_id": "AC-11110515-2026-01-08",
    "unit_id": "11110515",
    "date": "2026-01-08",
    "title": "야간 악취 민원 급증: 야간/주말 집중 점검 권고",
    "why": "악취 민원 증가율이 높고(상위 5%), 야간 집중도가 높아 야간 배출/관리 공백 가능성이 큼",
    "recommended_actions": [
      "야간(20~02시) 집중 청소/수거",
      "주말 민원 다발 시간대 순찰 강화"
    ],
    "tags": ["night_spike", "odor"],
    "confidence": 0.78,
    "limitations": [
      "이벤트/상권 영향 가능",
      "민원 데이터는 사후 신고 기반"
    ]
  }
]
```

---

## 5. Dashboard

### `GET /dashboard/human-signal`
민원 데이터 조회

**Query Parameters:**
- `date` (string, optional): 날짜 (없으면 오늘)
- `unit_id` (string, optional): 특정 지역만
- `period` (string, optional, default: "day"): 기간 (`day`, `week`, `month`)

**Response:**
```json
{
  "success": true,
  "period": "day",
  "date_range": {
    "start": "2026-01-08",
    "end": "2026-01-08"
  },
  "summary": {
    "total_complaints": 25,
    "average_per_day": 25,
    "by_day_of_week": {
      "0": 5,
      "1": 3
    },
    "by_hour": {
      "20": 3,
      "21": 5
    },
    "hour_pattern": [
      { "hour": 0, "complaints": 0 },
      { "hour": 1, "complaints": 0 }
    ],
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

### `GET /dashboard/population-signal`
생활인구 데이터 조회

**Query Parameters:**
- `date` (string, optional): 날짜
- `unit_id` (string, optional): 특정 지역만
- `period` (string, optional, default: "day"): 기간 (`day`, `week`, `month`)

**Response:**
```json
{
  "success": true,
  "period": "day",
  "date_range": {
    "start": "2026-01-08",
    "end": "2026-01-08"
  },
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

### `GET /dashboard/uci`
편의성 지수 조회 (주간/월별/분기별)

**Query Parameters:**
- `date` (string, optional): 날짜
- `unit_id` (string, optional): 특정 지역만
- `period` (string, optional, default: "week"): 기간 (`week`, `month`, `quarter`)

**Response:**
```json
{
  "success": true,
  "period": "week",
  "date_range": {
    "start": "2026-01-01",
    "end": "2026-01-08"
  },
  "summary": {
    "average_score": 65.5,
    "grade_distribution": {
      "A": 5,
      "B": 10,
      "C": 15,
      "D": 12,
      "E": 8
    }
  },
  "trends": [
    {
      "date": "2026-01-08",
      "unit_id": "11110515",
      "uci_score": 75.3,
      "uci_grade": "D"
    }
  ]
}
```

### `GET /dashboard/interventions`
개선 사업 데이터 조회

**Query Parameters:**
- `unit_id` (string, optional): 특정 지역만
- `status` (string, optional): 상태 (`active`, `completed`)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "active": 5,
  "completed": 5,
  "data": [
    {
      "intervention_id": "65a1b2c3d4e5f6a7b8c9d0e1",
      "unit_id": "11110515",
      "intervention_type": "night_cleanup",
      "start_date": "2026-01-08",
      "end_date": null,
      "status": "active",
      "progress": 25,
      "note": "야간 집중 청소 실시"
    }
  ]
}
```

### `GET /dashboard/interventions/{intervention_id}/effect`
개입 전후 효과 조회

**Path Parameters:**
- `intervention_id` (string, required): 개입 ID

**Query Parameters:**
- `baseline_weeks` (integer, optional, default: 4): 기준 기간 (주)
- `followup_weeks` (integer, optional, default: 4): 추적 기간 (주)

**Response:**
```json
{
  "success": true,
  "intervention": {
    "intervention_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "unit_id": "11110515",
    "intervention_type": "night_cleanup",
    "start_date": "2026-01-08"
  },
  "effect": {
    "baseline_period": {
      "start": "2025-12-11",
      "end": "2026-01-07",
      "average_uci": 80.5,
      "data": [
        {
          "date": "2025-12-11",
          "uci_score": 82.5
        }
      ]
    },
    "followup_period": {
      "start": "2026-01-08",
      "end": "2026-02-05",
      "average_uci": 65.2,
      "data": [
        {
          "date": "2026-01-08",
          "uci_score": 75.2
        }
      ]
    },
    "improvement": 19.0,
    "effect_size": 15.3
  }
}
```

### `GET /dashboard/trends`
전체 추세 지표 조회 (분기별)

**Query Parameters:**
- `period` (string, optional, default: "quarter"): 기간 (`week`, `month`, `quarter`)

**Response:**
```json
{
  "success": true,
  "period": "quarter",
  "trends": [
    {
      "period": "2024 Q1",
      "citywide": 64,
      "improvement": 3
    }
  ]
}
```

### `GET /dashboard/regional-trends`
지역별 현황 조회 (구 단위)

**Query Parameters:**
- `date` (string, optional): 날짜

**Response:**
```json
{
  "success": true,
  "date": "2026-01-08",
  "regions": [
    {
      "district": "강남구",
      "lat": 37.5172,
      "lng": 127.0473,
      "trend": "improving",
      "index": 64
    }
  ]
}
```

### `GET /dashboard/time-pattern`
시간대별 패턴 분석

**Query Parameters:**
- `unit_id` (string, required): 지역 ID
- `date` (string, optional): 날짜

**Response:**
```json
{
  "success": true,
  "unit_id": "11110515",
  "location": "서울시 강남구 역삼동 123-45",
  "hour_pattern": [
    {
      "hour": 0,
      "complaints": 0,
      "population": 150
    }
  ],
  "day_pattern": [
    { "day": "월", "complaints": 3 },
    { "day": "화", "complaints": 4 }
  ],
  "peak_hours": [20, 21, 22, 23],
  "recommended_action": "야간 집중 관리 필요 (20-23시)"
}
```

### `GET /dashboard/blind-spots`
사각지대 탐지

**Query Parameters:**
- `date` (string, optional): 날짜
- `risk_level` (string, optional): 위험도 (`high`, `medium`, `low`)

**Response:**
```json
{
  "success": true,
  "date": "2026-01-08",
  "blind_spots": [
    {
      "id": "bs1",
      "location": "서울시 강남구 논현동 78-90",
      "lat": 37.5120,
      "lng": 127.0280,
      "risk_level": "high",
      "detection_reason": "민원은 적으나 비둘기 활동이 급증하여 사각지대 가능성",
      "signals": {
        "human": {
          "value": 3,
          "status": "low"
        },
        "geo": {
          "value": 6.5,
          "status": "normal"
        }
      },
      "recommended_action": "현장 점검 및 추가 모니터링 필요"
    }
  ]
}
```

---

## 6. GeoJSON

### `GET /geo/comfort-index.geojson`
Comfort Index GeoJSON (Mapbox용)

**Query Parameters:**
- `date` (string, required): 날짜 (YYYY-MM-DD)

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "properties": {
        "unit_id": "11110515",
        "name": "필운동",
        "uci_score": 78.2,
        "uci_grade": "D"
      }
    }
  ]
}
```

---

## 7. Interventions

### `POST /interventions`
조치 등록

**Request Body:**
```json
{
  "unit_id": "11110515",
  "intervention_type": "night_cleanup",
  "start_date": "2026-01-08",
  "end_date": null,
  "note": "야간 집중 청소 실시",
  "created_by": "admin",
  "meta": {}
}
```

**Response:**
```json
{
  "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
  "unit_id": "11110515",
  "intervention_type": "night_cleanup",
  "start_date": "2026-01-08",
  "end_date": null,
  "note": "야간 집중 청소 실시",
  "created_by": "admin",
  "created_at": "2026-01-08T00:00:00.000Z"
}
```

---

## 8. UCI Info

### `GET /uci-info`
UCI 계산 로직 설명 조회

**Response:**
```json
{
  "success": true,
  "data": {
    "description": "Urban Comfort Index(UCI)는 공개 가능한 도시 데이터를 활용하여...",
    "formula": "UCI = (HumanScore × 0.5) + (GeoScore × 0.3) + (PopulationScore × 0.2) × 100",
    "signal_groups": [
      {
        "name": "Human Signal",
        "weight": 0.5,
        "description": "민원 기반 신호",
        "components": [...]
      }
    ],
    "weights": {
      "human": 0.5,
      "geo": 0.3,
      "population": 0.2
    },
    "grades": [
      {
        "grade": "A",
        "range": "0-20",
        "description": "매우 양호",
        "status": "low",
        "status_kr": "낮음"
      }
    ],
    "window": {
      "weeks": 4,
      "days": 28
    }
  }
}
```

---

## 9. Anomaly Detection (AI)

### `POST /anomaly/compute`
AI 이상 탐지 실행

**Request Body:**
```json
{
  "date": "2025-12-01",
  "unit_id": "11110"
}
```

**Response:**
```json
{
  "success": true,
  "message": "이상 탐지 완료",
  "date": "2025-12-01",
  "total": 48,
  "success_count": 45,
  "failed_count": 3,
  "anomaly_count": 12,
  "results": [
    {
      "unit_id": "11110",
      "anomaly_score": 0.85,
      "anomaly_flag": true,
      "status": "success"
    }
  ]
}
```

### `GET /anomaly`
이상 탐지 결과 조회

**Query Parameters:**
- `date` (string, optional): 날짜
- `unit_id` (string, optional): 특정 지역만
- `anomaly_flag` (boolean, optional): 이상 탐지된 것만 (`true`/`false`)

**Response:**
```json
[
  {
    "unit_id": "11110",
    "date": "2025-12-01",
    "anomaly_score": 0.85,
    "anomaly_flag": true,
    "explanation": "최근 4주 민원이 45% 증가, 통계적 이상치 감지",
    "features": {
      "complaint_change_4w": 0.45,
      "complaint_growth_rate": 0.32
    }
  }
]
```

### `GET /anomaly/{unit_id}`
특정 지역의 이상 탐지 결과 조회

**Path Parameters:**
- `unit_id` (string, required): 지역 ID

**Query Parameters:**
- `date` (string, optional): 날짜 (없으면 최신)

**Response:**
```json
{
  "unit_id": "11110",
  "date": "2025-12-01",
  "anomaly_score": 0.85,
  "anomaly_flag": true,
  "explanation": "최근 4주 민원이 45% 증가"
}
```

---

## 10. Analytics

### `GET /analytics/trend`
UCI 트렌드 분석 및 예측

**Query Parameters:**
- `unit_id` (string, required): 지역 ID
- `days` (integer, optional, default: 30): 분석 기간 (일)
- `forecast_days` (integer, optional, default: 7): 예측 기간 (일)

**Response:**
```json
{
  "unit_id": "11110",
  "hasData": true,
  "data_quality": "sufficient",
  "current": {
    "uci_score": 63.14,
    "uci_grade": "D"
  },
  "trend": {
    "direction": "increasing",
    "slope": 0.5,
    "change_rate": "12.5",
    "confidence": 0.85
  },
  "forecast": [
    {
      "date": "2025-12-08",
      "value": 65.2,
      "confidence": 0.9
    }
  ],
  "moving_averages": {
    "ma7": [...],
    "ma14": [...]
  },
  "seasonality": {...},
  "statistics": {
    "min": 50.0,
    "max": 70.0,
    "mean": 60.0,
    "std": 5.0
  }
}
```

### `GET /analytics/complaint-trend`
민원 트렌드 분석

**Query Parameters:**
- `unit_id` (string, required): 지역 ID
- `days` (integer, optional, default: 30): 분석 기간 (일)
- `forecast_days` (integer, optional, default: 7): 예측 기간 (일)

**Response:**
```json
{
  "unit_id": "11110",
  "hasData": true,
  "current": {
    "total_complaints": 25
  },
  "trend": {
    "direction": "increasing",
    "slope": 0.3,
    "confidence": 0.75
  },
  "forecast": [...],
  "seasonality": {...}
}
```

### `GET /analytics/data-quality`
데이터 품질 리포트

**Query Parameters:**
- `unit_id` (string, optional): 특정 지역만
- `start_date` (string, required): 시작 날짜 (YYYY-MM-DD)
- `end_date` (string, required): 종료 날짜 (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "report_date": "2026-01-08",
  "unit_id": "11110",
  "date_range": {
    "start": "2025-11-01",
    "end": "2025-12-01"
  },
  "completeness_score": 87.33,
  "missing_data_points": 5,
  "outliers_detected": 12,
  "quality_score": 87.33,
  "details": {
    "human_signals": {...},
    "population_signals": {...},
    "comfort_index": {...}
  }
}
```

### `POST /analytics/augment`
데이터 보강 (결측치 채우기)

**Request Body:**
```json
{
  "unit_id": "11110",
  "start_date": "2025-11-01",
  "end_date": "2025-12-01",
  "signal_type": "human"
}
```

**Response:**
```json
{
  "success": true,
  "generated_count": 10,
  "data": [...],
  "note": "이 데이터는 통계적 방법으로 생성되었으며 실제 데이터가 아닙니다."
}
```

---

## 11. Data Management

### `POST /data/upload`
CSV 파일 업로드

**Request (multipart/form-data):**
- `file` (file, required): CSV 파일
- `type` (string, optional): `raw`, `processed`, `uploads` (default: `raw`)

**Response:**
```json
{
  "success": true,
  "message": "파일이 성공적으로 업로드되었습니다.",
  "file": {
    "filename": "1704700800000_signals_human_20260108.csv",
    "originalname": "signals_human_20260108.csv",
    "path": "data/raw/1704700800000_signals_human_20260108.csv",
    "size": 15234,
    "type": "raw"
  }
}
```

### `GET /data/files`
업로드된 파일 목록 조회

**Query Parameters:**
- `type` (string, optional, default: "raw"): 파일 타입

**Response:**
```json
{
  "success": true,
  "type": "raw",
  "count": 3,
  "files": [
    {
      "filename": "1704700800000_signals_human_20260108.csv",
      "size": 15234,
      "created": "2026-01-08T00:00:00.000Z",
      "modified": "2026-01-08T00:00:00.000Z"
    }
  ]
}
```

### `GET /data/files/{filename}`
CSV 파일 미리보기

**Path Parameters:**
- `filename` (string, required): 파일명

**Query Parameters:**
- `type` (string, optional, default: "raw"): 파일 타입
- `limit` (integer, optional, default: 100): 미리보기 행 수

**Response:**
```json
{
  "success": true,
  "filename": "signals_human_20260108.csv",
  "total_rows": 100,
  "preview_rows": 100,
  "data": [
    {
      "unit_id": "11110515",
      "date": "2026-01-08",
      "complaint_total": "5"
    }
  ]
}
```

### `DELETE /data/files/{filename}`
CSV 파일 삭제

**Path Parameters:**
- `filename` (string, required): 파일명

**Query Parameters:**
- `type` (string, optional, default: "raw"): 파일 타입

**Response:**
```json
{
  "success": true,
  "message": "파일이 삭제되었습니다."
}
```

### `POST /data/import/{type}`
CSV 데이터 임포트 (MongoDB 저장)

**Path Parameters:**
- `type` (string, required): 데이터 타입 (`human`, `geo`, `population`, `spatial_units`)

**Request Body:**
```json
{
  "filename": "signals_human_20260108.csv",
  "type": "raw"
}
```

**Response:**
```json
{
  "success": true,
  "message": "CSV 파일이 성공적으로 임포트되었습니다.",
  "total_rows": 100,
  "success_count": 98,
  "error_count": 2
}
```

---

## 12. Spatial Units

### `GET /units`
공간 단위 목록 조회

**Query Parameters:**
- `q` (string, optional): 검색어 (이름)
- `limit` (integer, optional): 제한

**Response:**
```json
[
  {
    "_id": "11110515",
    "name": "필운동",
    "geom": {
      "type": "Polygon",
      "coordinates": [[...]]
    }
  }
]
```

### `GET /units/{unit_id}`
특정 공간 단위 조회

**Path Parameters:**
- `unit_id` (string, required): 지역 ID

**Response:**
```json
{
  "_id": "11110515",
  "name": "필운동",
  "geom": {...}
}
```

### `GET /units/within/geo`
지정된 위치 반경 내 공간 단위 조회

**Query Parameters:**
- `lng` (number, required): 경도
- `lat` (number, required): 위도
- `radius_m` (number, required): 반경 (미터)

**Response:**
```json
[
  {
    "_id": "11110515",
    "name": "필운동",
    "distance": 500
  }
]
```

### `POST /units`
공간 단위 생성

**Request Body:**
```json
{
  "_id": "11110515",
  "name": "필운동",
  "geom": {
    "type": "Polygon",
    "coordinates": [[...]]
  }
}
```

**Response:**
```json
{
  "_id": "11110515",
  "name": "필운동",
  "geom": {...}
}
```

---

## 📝 참고사항

### 날짜 형식
- 모든 날짜는 `YYYY-MM-DD` 형식 (예: `"2025-12-01"`)

### 상태 값 (Enum)
- **status**: `"low"` | `"medium"` | `"high"`
- **status_kr**: `"낮음"` | `"보통"` | `"높음"`
- **trend**: `"improving"` | `"stable"` | `"monitoring"` | `"attention"`
- **intervention_status**: `"active"` | `"completed"`
- **risk_level**: `"high"` | `"medium"` | `"low"`

### UCI 점수 vs 편의성 지수
- **UCI 점수** (`uci_score`): 0-100, **높을수록 위험/불편**
- **편의성 지수** (`comfort_index`): 0-100, **높을수록 편의** (100 - UCI)

### 에러 응답 형식
```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 메시지"
}
```

### 성공 응답 형식
대부분의 엔드포인트는 성공 시 `success: true` 필드를 포함하지만, 일부는 데이터 배열을 직접 반환합니다.

---

## 🔗 추가 리소스

- **Swagger UI**: `http://localhost:8000/docs`
- **API 루트**: `http://localhost:8000/`

---

**문서 버전**: 1.0.0  
**최종 업데이트**: 2026-01-12

