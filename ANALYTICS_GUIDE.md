# 데이터 분석 API 가이드

## 개요

데이터 분석을 위한 전용 엔드포인트입니다. 통계, 상관관계, 트렌드, 집계, 비교 분석을 제공합니다.

## 엔드포인트

### 1. 통계 분석

```bash
GET /api/v1/analytics/statistics?signal_type=human&field=complaint_total&date_start=2026-01-01&date_end=2026-01-31
```

**파라미터:**
- `signal_type`: human | geo | population | uci
- `field`: 분석할 필드명 (예: complaint_total, uci_score, night_ratio)
- `date_start`, `date_end`: 날짜 범위 (선택)
- `unit_id`: 특정 unit만 분석 (선택)

**응답:**
```json
{
  "field": "complaint_total",
  "count": 100,
  "mean": 5.2,
  "median": 4.0,
  "std_dev": 2.1,
  "min": 0,
  "max": 15,
  "q25": 3,
  "q75": 7,
  "range": 15
}
```

### 2. 상관관계 분석

```bash
GET /api/v1/analytics/correlation?signal_type=human&field1=complaint_total&field2=night_ratio&date_start=2026-01-01&date_end=2026-01-31
```

**응답:**
```json
{
  "field1": "complaint_total",
  "field2": "night_ratio",
  "correlation": 0.65,
  "interpretation": "중간 정도의 양의 상관관계",
  "sample_size": 100
}
```

### 3. 트렌드 분석

```bash
GET /api/v1/analytics/trend?signal_type=human&field=complaint_total&date_start=2026-01-01&date_end=2026-01-31&group_by=day
```

**응답:**
```json
{
  "field": "complaint_total",
  "trend_direction": "increasing",
  "trend_rate": 0.15,
  "data_points": [
    { "date": "2026-01-01", "value": 5 },
    { "date": "2026-01-08", "value": 8 }
  ],
  "summary": {
    "first_value": 5,
    "last_value": 8,
    "change_percent": 60,
    "period_days": 31
  }
}
```

### 4. 집계 분석

```bash
GET /api/v1/analytics/aggregate?signal_type=human&group_by=unit_id&field=complaint_total&date_start=2026-01-01&date_end=2026-01-31
```

**응답:**
```json
{
  "group_by": "unit_id",
  "field": "complaint_total",
  "groups": {
    "11110515": {
      "count": 30,
      "sum": 150,
      "avg": 5.0,
      "min": 0,
      "max": 12,
      "median": 5
    }
  }
}
```

### 5. 비교 분석

```bash
GET /api/v1/analytics/comparison?signal_type=human&field=complaint_total&period1_start=2025-12-01&period1_end=2025-12-31&period2_start=2026-01-01&period2_end=2026-01-31
```

**응답:**
```json
{
  "field": "complaint_total",
  "period1": {
    "start": "2025-12-01",
    "end": "2025-12-31",
    "avg": 4.5,
    "total": 135
  },
  "period2": {
    "start": "2026-01-01",
    "end": "2026-01-31",
    "avg": 6.2,
    "total": 186
  },
  "difference": {
    "absolute": 51,
    "percent": 37.8,
    "avg_change": 1.7
  },
  "significance": "significant_increase"
}
```

### 6. 데이터 내보내기

```bash
GET /api/v1/analytics/export?signal_type=human&date_start=2026-01-01&date_end=2026-01-31&format=csv
```

**응답:** CSV 파일 다운로드 또는 JSON

## 사용 예시

### 민원 데이터 통계 분석
```bash
curl "http://localhost:8000/api/v1/analytics/statistics?signal_type=human&field=complaint_total&date_start=2026-01-01&date_end=2026-01-31"
```

### 야간 비율과 민원 총량 상관관계
```bash
curl "http://localhost:8000/api/v1/analytics/correlation?signal_type=human&field1=complaint_total&field2=night_ratio"
```

### UCI 점수 트렌드 분석
```bash
curl "http://localhost:8000/api/v1/analytics/trend?signal_type=uci&field=uci_score&date_start=2025-12-01&date_end=2026-01-31"
```

### 지역별 민원 집계
```bash
curl "http://localhost:8000/api/v1/analytics/aggregate?signal_type=human&group_by=unit_id&field=complaint_total"
```

### 전월 대비 비교
```bash
curl "http://localhost:8000/api/v1/analytics/comparison?signal_type=human&field=complaint_total&period1_start=2025-12-01&period1_end=2025-12-31&period2_start=2026-01-01&period2_end=2026-01-31"
```

### 분석 결과 CSV 다운로드
```bash
curl "http://localhost:8000/api/v1/analytics/export?signal_type=human&format=csv" -o analysis.csv
```

