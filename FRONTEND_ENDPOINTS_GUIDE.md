# 프론트엔드 엔드포인트 가이드

## 📋 개요

프론트엔드에서 실제로 사용하는 엔드포인트만 정리한 문서입니다.

---

## 🎯 공개 뷰 (PublicView) - 5개 섹션

### 1. 전체 추세 지표 (TrendIndicators)

**엔드포인트**: `GET /api/v1/dashboard/trends?period=quarter`

**설명**: 도시 전역의 편의성 지수 변화 추이를 분기별 또는 월별로 제공합니다.

**파라미터**:
- `period` (선택): `quarter` | `month` (기본값: `quarter`)

**응답 예시**:
```json
{
  "success": true,
  "period": "quarter",
  "data": [
    {
      "period": "2023 Q1",
      "citywide": 64,
      "improvement": 3
    },
    {
      "period": "2023 Q2",
      "citywide": 67,
      "improvement": 3
    }
  ]
}
```

**사용 위치**: 전체 추세 지표 섹션의 Area Chart

---

### 2. 지역별 현황 (RegionalTrendMap)

**엔드포인트**: `GET /api/v1/dashboard/regional-trends?date=2024-01-28`

**설명**: 구 단위 지역별 도시 편의성 상태를 지도에 표시하기 위한 데이터를 제공합니다.

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD), 기본값: 오늘

**응답 예시**:
```json
{
  "success": true,
  "data": [
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

**사용 위치**: 지역별 현황 지도 (마커 표시)

**대체 엔드포인트**: `GET /api/v1/geo/comfort-index.geojson?date=2024-01-28`
- GeoJSON 형식으로 지도 라이브러리에서 직접 사용 가능

---

### 3. 지역별 신호 추세 (SignalTrends)

**엔드포인트 1**: `GET /api/v1/dashboard/human-signal?date=2024-01-28&period=month`

**설명**: 민원 데이터의 추세를 조회합니다. 시간대별, 요일별 패턴도 포함됩니다.

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `unit_id` (선택): 특정 지역만 조회
- `period` (선택): `day` | `week` | `month` (기본값: `day`)

**응답 예시**:
```json
{
  "success": true,
  "period": "month",
  "summary": {
    "total_complaints": 150,
    "by_day_of_week": { "0": 5, "1": 3, ... },
    "by_hour": { "20": 10, "21": 12, ... },
    "hour_pattern": [
      { "hour": 0, "complaints": 0 },
      { "hour": 20, "complaints": 10 }
    ]
  },
  "trends": [
    {
      "date": "2024-01-28",
      "total": 25,
      "odor": 8,
      "trash": 12,
      "night_ratio": 0.65,
      "repeat_ratio": 0.45
    }
  ]
}
```

**엔드포인트 2**: `GET /api/v1/dashboard/population-signal?date=2024-01-28&period=month`

**설명**: 생활인구 데이터의 추세를 조회합니다.

**파라미터**: 동일

**응답 예시**:
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
      "date": "2024-01-28",
      "pop_total": 10000,
      "pop_night": 2000,
      "pop_change_rate": 0.15,
      "night_ratio": 0.2
    }
  ]
}
```

**사용 위치**: 지역별 신호 추세 카드 (민원/생활인구 추세 표시)

---

### 4. 개선 현황 (ImprovementStatus)

**엔드포인트**: `GET /api/v1/dashboard/interventions?status=active`

**설명**: 진행 중인 도시 편의성 개선 사업 현황을 조회합니다.

**파라미터**:
- `unit_id` (선택): 특정 지역만 조회
- `status` (선택): `active` | `completed` (없으면 전체)

**응답 예시**:
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
      "start_date": "2024-01-01",
      "end_date": null,
      "status": "active",
      "progress": 75,
      "note": "야간 집중 청소 실시"
    }
  ]
}
```

**사용 위치**: 개선 현황 카드

---

### 5. 민원 신고 안내 (ReportingGuide)

**엔드포인트**: 없음 (정적 콘텐츠)

---

## 🔧 관리자 대시보드 (AdminDashboard) - 5개 섹션

### 1. 우선순위 검사 대기열 (PriorityQueue)

**엔드포인트 1**: `GET /api/v1/priority-queue?date=2024-01-28&top_n=20`

**설명**: 편의성 지수와 신호 분석을 기반으로 한 순위별 검사 목록을 제공합니다.

**파라미터**:
- `date` (필수): 날짜 (YYYY-MM-DD)
- `top_n` (선택): 상위 N개 (기본값: 20, 최대: 100)

**응답 예시**:
```json
[
  {
    "rank": 1,
    "unit_id": "11110515",
    "name": "청운효자동",
    "uci_score": 87.3,
    "uci_grade": "E",
    "why_summary": "최근 4주 악취 민원 +38%, 야간 집중도 0.72",
    "key_drivers": [
      { "signal": "complaint_odor_growth", "value": 0.83 },
      { "signal": "night_ratio", "value": 0.72 }
    ]
  }
]
```

**엔드포인트 2**: `GET /api/v1/comfort-index/{unit_id}?date=2024-01-28`

**설명**: 특정 지역의 상세 편의성 지수 정보를 조회합니다. 우선순위 대기열에서 항목을 선택했을 때 상세 정보를 표시합니다.

**파라미터**:
- `unit_id` (경로): 지역 ID
- `date` (선택): 날짜 (YYYY-MM-DD)

**응답 예시**:
```json
{
  "unit_id": "11110515",
  "date": "2024-01-28",
  "uci_score": 87.3,
  "uci_grade": "E",
  "components": {
    "human_score": 0.65,
    "geo_score": 0.55,
    "population_score": 0.45
  },
  "explain": {
    "why_summary": "최근 4주 악취 민원 +38%, 야간 집중도 0.72",
    "key_drivers": [...]
  }
}
```

**사용 위치**: 우선순위 검사 대기열 목록 및 상세 정보

---

### 2. 사각지대 탐지 (BlindSpotDetection)

**엔드포인트**: `GET /api/v1/dashboard/blind-spots?date=2024-01-28&risk_level=high`

**설명**: 신호 간 불일치를 분석하여 행정 데이터가 놓치는 사각지대를 탐지합니다.

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `risk_level` (선택): `high` | `medium` | `low` (없으면 전체)

**응답 예시**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "bs1",
      "location": "서울시 강남구 논현동",
      "lat": 37.5120,
      "lng": 127.0280,
      "risk_level": "high",
      "detection_reason": "민원은 적으나 비둘기 활동이 급증하여 사각지대 가능성",
      "signals": {
        "human": { "value": 3, "status": "low" },
        "geo": { "value": 6.5, "status": "normal" },
        "uci": { "value": 45, "status": "normal" }
      },
      "recommended_action": "현장 점검 및 추가 모니터링 필요"
    }
  ]
}
```

**사용 위치**: 사각지대 탐지 지도 및 목록

---

### 3. 시간대별 패턴 분석 (TimePatternAnalysis)

**엔드포인트**: `GET /api/v1/dashboard/time-pattern?unit_id={unitId}&date=2024-01-28&period=week`

**설명**: 민원 발생 시간대와 생활인구 패턴을 분석하여 최적의 관리 시점을 제안합니다.

**파라미터**:
- `unit_id` (필수): 지역 ID
- `date` (선택): 날짜 (YYYY-MM-DD)
- `period` (선택): `week` | `month` (기본값: `week`)

**응답 예시**:
```json
{
  "success": true,
  "location": "서울시 강남구 역삼동",
  "hour_pattern": [
    { "hour": 0, "complaints": 0, "population": 150 },
    { "hour": 20, "complaints": 5, "population": 800 }
  ],
  "day_pattern": [
    { "day": "월", "complaints": 3 },
    { "day": "화", "complaints": 4 }
  ],
  "peak_hours": [20, 21, 22, 23],
  "recommended_action": "야간 집중 관리 필요 (20-23시)"
}
```

**사용 위치**: 시간대별 패턴 분석 차트 (Bar Chart, Composed Chart)

---

### 4. 개입 권고사항 (ActionRecommendations)

**엔드포인트 1**: `GET /api/v1/action-cards?date=2024-01-28&unit_id={unitId}`

**설명**: 데이터 기반 개입 유형 및 예상 효과 분석을 제공합니다.

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `unit_id` (선택): 특정 지역만 조회

**응답 예시**:
```json
[
  {
    "card_id": "AC-11110515-2024-01-28",
    "unit_id": "11110515",
    "date": "2024-01-28",
    "title": "야간 악취 민원 급증: 야간/주말 집중 점검 권고",
    "why": "악취 민원 증가율이 높고(상위 5%), 야간 집중도가 높아 야간 배출/관리 공백 가능성이 큼",
    "recommended_actions": [
      "야간(20~02시) 집중 청소/수거",
      "주말 민원 다발 시간대 순찰 강화"
    ],
    "tags": ["night_spike", "odor", "needs_field_check"],
    "confidence": 0.78,
    "limitations": ["이벤트/상권 영향 가능", "민원 데이터는 사후 신고 기반"]
  }
]
```

**엔드포인트 2**: `POST /api/v1/action-cards/generate`

**설명**: 특정 날짜와 지역에 대한 액션 카드를 생성합니다.

**요청 본문**:
```json
{
  "date": "2024-01-28",
  "unit_ids": ["11110515"],
  "use_pigeon": false
}
```

**사용 위치**: 개입 권고사항 카드

---

### 5. 개입 전후 효과 추적 (BeforeAfterTracking)

**엔드포인트**: `GET /api/v1/dashboard/interventions/{intervention_id}/effect?baseline_weeks=4&followup_weeks=4`

**설명**: 과거 개입 사례의 효과 측정 및 검증 결과를 제공합니다.

**파라미터**:
- `intervention_id` (경로): 개입 ID
- `baseline_weeks` (선택): 기준 기간 주수 (기본값: 4)
- `followup_weeks` (선택): 추적 기간 주수 (기본값: 4)

**응답 예시**:
```json
{
  "success": true,
  "intervention": {
    "intervention_id": "...",
    "unit_id": "11110515",
    "intervention_type": "night_cleanup",
    "start_date": "2024-01-10"
  },
  "effect": {
    "baseline_period": {
      "start": "2023-12-13",
      "end": "2024-01-09",
      "average_uci": 35,
      "data": [
        { "date": "2023-12-13", "uci_score": 35 },
        { "date": "2024-01-09", "uci_score": 30 }
      ]
    },
    "followup_period": {
      "start": "2024-01-10",
      "end": "2024-02-07",
      "average_uci": 58,
      "data": [
        { "date": "2024-01-10", "uci_score": 30 },
        { "date": "2024-02-07", "uci_score": 65 }
      ]
    },
    "improvement": 35,
    "effect_size": 23
  }
}
```

**사용 위치**: 개입 전후 효과 추적 Line Chart

---

## 🔄 데이터 관리 엔드포인트

### CSV 업로드 및 임포트

**엔드포인트 1**: `POST /api/v1/data/upload`
- CSV 파일 업로드

**엔드포인트 2**: `POST /api/v1/data/import/{type}`
- CSV 데이터를 MongoDB에 임포트
- `type`: `human` | `geo` | `population` | `spatial_units`

**엔드포인트 3**: `GET /api/v1/data/files`
- 업로드된 파일 목록 조회

---

## 📊 분석 엔드포인트 (선택적)

### 데이터 분석

**엔드포인트**: `GET /api/v1/analytics/*`
- 통계 분석, 상관관계, 트렌드, 집계, 비교 분석
- 프론트엔드에서 직접 사용하지 않을 수 있음 (백엔드 내부 분석용)

---

## 🗺️ 지도용 GeoJSON

**엔드포인트 1**: `GET /api/v1/geo/comfort-index.geojson?date=2024-01-28`
- 편의성 지수 GeoJSON (Mapbox용)

**엔드포인트 2**: `GET /api/v1/geo/priority.geojson?date=2024-01-28&top_n=20`
- 우선순위 대기열 GeoJSON (Mapbox용)

---

## ✅ 핵심 엔드포인트 요약

### 공개 뷰 (7개)
1. `GET /api/v1/dashboard/trends` - 분기별 추세
2. `GET /api/v1/dashboard/regional-trends` - 지역별 현황
3. `GET /api/v1/dashboard/human-signal` - 민원 데이터
4. `GET /api/v1/dashboard/population-signal` - 생활인구 데이터
5. `GET /api/v1/dashboard/uci` - 편의성 지수
6. `GET /api/v1/dashboard/interventions` - 개선 현황
7. `GET /api/v1/geo/comfort-index.geojson` - GeoJSON

### 관리자 대시보드 (6개)
1. `GET /api/v1/priority-queue` - 우선순위 대기열
2. `GET /api/v1/comfort-index/{unitId}` - 상세 편의성 지수
3. `GET /api/v1/dashboard/blind-spots` - 사각지대 탐지
4. `GET /api/v1/dashboard/time-pattern` - 시간대별 패턴
5. `GET /api/v1/action-cards` - 개입 권고사항
6. `GET /api/v1/dashboard/interventions/{id}/effect` - 개입 효과

### 데이터 관리 (3개)
1. `POST /api/v1/data/upload` - 파일 업로드
2. `POST /api/v1/data/import/{type}` - 데이터 임포트
3. `GET /api/v1/data/files` - 파일 목록

**총 16개 핵심 엔드포인트**

---

## 📝 참고사항

1. **날짜 형식**: 모든 날짜는 `YYYY-MM-DD` 형식
2. **선택적 필드**: `populationSignals`, `pigeonSignals` 등은 선택적
3. **에러 처리**: 모든 엔드포인트는 `success: false` 형식으로 에러 반환
4. **인증**: 현재는 인증 없이 접근 가능 (추후 JWT/API Key 추가 가능)

