# 프론트엔드 API 가이드라인

## 📋 개요

이 문서는 프론트엔드 개발자를 위한 최종 API 가이드라인입니다.  
**총 17개의 핵심 엔드포인트**만 제공되며, 모든 엔드포인트는 `/docs`에서 확인 가능합니다.

**Base URL**: `http://localhost:8000` (개발 환경)  
**API Prefix**: `/api/v1`

---

## 🎯 엔드포인트 분류

### 공개 뷰 (PublicView) - 7개
일반 사용자에게 공개되는 도시 편의성 현황 대시보드

### 관리자 대시보드 (AdminDashboard) - 6개
관리자가 사용하는 우선순위 기반 의사결정 도구

### 데이터 관리 - 3개
CSV 파일 업로드 및 데이터 임포트

### 기본 조회 - 1개
UCI 목록 조회

---

## 🌐 공개 뷰 (PublicView) 엔드포인트

### 1. 전체 추세 지표

**엔드포인트**: `GET /api/v1/dashboard/trends`

**설명**: 도시 전역의 편의성 지수 변화 추이를 분기별 또는 월별로 제공

**파라미터**:
- `period` (선택): `quarter` | `month` (기본값: `quarter`)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/trends?period=quarter')
  .then(res => res.json())
  .then(data => console.log(data));
```

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

### 2. 지역별 현황

**엔드포인트**: `GET /api/v1/dashboard/regional-trends`

**설명**: 구 단위 지역별 도시 편의성 상태를 지도에 표시

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD), 기본값: 오늘

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/regional-trends?date=2024-01-28')
  .then(res => res.json())
  .then(data => console.log(data));
```

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

### 3. 민원 데이터

**엔드포인트**: `GET /api/v1/dashboard/human-signal`

**설명**: 민원 데이터의 추세를 조회. 시간대별, 요일별 패턴 포함

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `unit_id` (선택): 특정 지역만 조회
- `period` (선택): `day` | `week` | `month` (기본값: `day`)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/human-signal?date=2024-01-28&period=month')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "period": "month",
  "date_range": {
    "start": "2023-12-29",
    "end": "2024-01-28"
  },
  "summary": {
    "total_complaints": 150,
    "average_per_day": 5,
    "by_day_of_week": {
      "0": 5,
      "1": 3,
      "2": 4
    },
    "by_hour": {
      "20": 10,
      "21": 12
    },
    "hour_pattern": [
      { "hour": 0, "complaints": 0 },
      { "hour": 20, "complaints": 10 }
    ],
    "repeat_count": 8
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

**사용 위치**: 지역별 신호 추세 카드 (민원 추세 표시)

---

### 4. 생활인구 데이터

**엔드포인트**: `GET /api/v1/dashboard/population-signal`

**설명**: 생활인구 데이터의 추세를 조회

**파라미터**: 동일 (date, unit_id, period)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/population-signal?date=2024-01-28&period=month')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "period": "month",
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

**사용 위치**: 지역별 신호 추세 카드 (생활인구 추세 표시)

---

### 5. 편의성 지수

**엔드포인트**: `GET /api/v1/dashboard/uci`

**설명**: 편의성 지수를 주간/월별/분기별로 조회

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `unit_id` (선택): 특정 지역만 조회
- `period` (선택): `week` | `month` | `quarter` (기본값: `week`)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/uci?date=2024-01-28&period=week')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "period": "week",
  "date_range": {
    "start": "2024-01-22",
    "end": "2024-01-28"
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
      "date": "2024-01-28",
      "unit_id": "11110515",
      "uci_score": 75.3,
      "uci_grade": "D",
      "components": { ... },
      "explain": { ... }
    }
  ]
}
```

**사용 위치**: 전체 추세 지표, 지역별 현황

---

### 6. 개선 현황

**엔드포인트**: `GET /api/v1/dashboard/interventions`

**설명**: 진행 중인 도시 편의성 개선 사업 현황

**파라미터**:
- `unit_id` (선택): 특정 지역만 조회
- `status` (선택): `active` | `completed` (없으면 전체)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/interventions?status=active')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
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

### 7. GeoJSON 지도 데이터

**엔드포인트**: `GET /api/v1/geo/comfort-index.geojson`

**설명**: Mapbox 등 지도 라이브러리용 GeoJSON 형식 데이터

**파라미터**:
- `date` (필수): 날짜 (YYYY-MM-DD)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/geo/comfort-index.geojson?date=2024-01-28')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[126.978, 37.566], ...]]
      },
      "properties": {
        "unit_id": "11110515",
        "name": "청운효자동",
        "uci_score": 78.2,
        "uci_grade": "D"
      }
    }
  ]
}
```

**사용 위치**: 지역별 현황 지도 (GeoJSON 직접 사용)

---

## 🔧 관리자 대시보드 (AdminDashboard) 엔드포인트

### 8. 우선순위 검사 대기열

**엔드포인트**: `GET /api/v1/priority-queue`

**설명**: 편의성 지수와 신호 분석을 기반으로 한 순위별 검사 목록

**파라미터**:
- `date` (필수): 날짜 (YYYY-MM-DD)
- `top_n` (선택): 상위 N개 (기본값: 20, 최대: 100)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/priority-queue?date=2024-01-28&top_n=20')
  .then(res => res.json())
  .then(data => console.log(data));
```

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

**사용 위치**: 우선순위 검사 대기열 목록

---

### 9. 상세 편의성 지수

**엔드포인트**: `GET /api/v1/comfort-index/{unit_id}`

**설명**: 특정 지역의 상세 편의성 지수 정보

**파라미터**:
- `unit_id` (경로): 지역 ID
- `date` (선택): 날짜 (YYYY-MM-DD), 없으면 최신

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/comfort-index/11110515?date=2024-01-28')
  .then(res => res.json())
  .then(data => console.log(data));
```

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
    "key_drivers": [
      { "signal": "complaint_odor_growth", "value": 0.83 },
      { "signal": "night_ratio", "value": 0.72 }
    ]
  }
}
```

**사용 위치**: 우선순위 대기열에서 항목 선택 시 상세 정보

---

### 10. 사각지대 탐지

**엔드포인트**: `GET /api/v1/dashboard/blind-spots`

**설명**: 신호 간 불일치를 분석하여 행정 데이터가 놓치는 사각지대 탐지

**파라미터**:
- `date` (선택): 날짜 (YYYY-MM-DD)
- `risk_level` (선택): `high` | `medium` | `low` (없으면 전체)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/blind-spots?date=2024-01-28&risk_level=high')
  .then(res => res.json())
  .then(data => console.log(data));
```

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

### 11. 시간대별 패턴 분석

**엔드포인트**: `GET /api/v1/dashboard/time-pattern`

**설명**: 민원 발생 시간대와 생활인구 패턴을 분석하여 최적의 관리 시점 제안

**파라미터**:
- `unit_id` (필수): 지역 ID
- `date` (선택): 날짜 (YYYY-MM-DD)
- `period` (선택): `week` | `month` (기본값: `week`)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/time-pattern?unit_id=11110515&date=2024-01-28&period=week')
  .then(res => res.json())
  .then(data => console.log(data));
```

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

### 12. 개입 권고사항

**엔드포인트**: `GET /api/v1/action-cards`

**설명**: 데이터 기반 개입 유형 및 예상 효과 분석

**파라미터**:
- `date` (필수): 날짜 (YYYY-MM-DD)
- `unit_id` (선택): 특정 지역만 조회

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/action-cards?date=2024-01-28&unit_id=11110515')
  .then(res => res.json())
  .then(data => console.log(data));
```

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
    "limitations": [
      "이벤트/상권 영향 가능",
      "민원 데이터는 사후 신고 기반"
    ]
  }
]
```

**사용 위치**: 개입 권고사항 카드

---

### 13. 개입 전후 효과 추적

**엔드포인트**: `GET /api/v1/dashboard/interventions/{intervention_id}/effect`

**설명**: 과거 개입 사례의 효과 측정 및 검증 결과

**파라미터**:
- `intervention_id` (경로): 개입 ID
- `baseline_weeks` (선택): 기준 기간 주수 (기본값: 4)
- `followup_weeks` (선택): 추적 기간 주수 (기본값: 4)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/dashboard/interventions/65a1b2c3d4e5f6a7b8c9d0e1/effect?baseline_weeks=4&followup_weeks=4')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "intervention": {
    "intervention_id": "65a1b2c3d4e5f6a7b8c9d0e1",
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

## 📊 데이터 관리 엔드포인트

### 14. CSV 파일 업로드

**엔드포인트**: `POST /api/v1/data/upload`

**설명**: CSV 파일을 서버에 업로드

**요청 형식**: `multipart/form-data`

**파라미터**:
- `file` (필수): CSV 파일
- `type` (선택): `raw` | `processed` | `uploads` (기본값: `raw`)

**요청 예시**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('type', 'raw');

fetch('http://localhost:8000/api/v1/data/upload', {
  method: 'POST',
  body: formData
})
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "filename": "1706457600000_signals_human.csv",
  "path": "data/raw/1706457600000_signals_human.csv",
  "size": 1024
}
```

---

### 15. 데이터 임포트

**엔드포인트**: `POST /api/v1/data/import/{type}`

**설명**: 업로드된 CSV 파일을 MongoDB에 임포트

**파라미터**:
- `type` (경로): `human` | `geo` | `population` | `spatial_units`

**요청 본문**:
```json
{
  "filename": "signals_human_20260108.csv",
  "type": "raw"
}
```

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/data/import/human', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: 'signals_human_20260108.csv',
    type: 'raw'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "imported": 100,
  "errors": 0,
  "message": "데이터 임포트가 완료되었습니다."
}
```

---

### 16. 파일 목록 조회

**엔드포인트**: `GET /api/v1/data/files`

**설명**: 업로드된 파일 목록 조회

**파라미터**:
- `type` (선택): `raw` | `processed` | `uploads` (기본값: `raw`)

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/data/files?type=raw')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
{
  "success": true,
  "files": [
    {
      "filename": "signals_human_20260108.csv",
      "size": 1024,
      "created": "2024-01-28T00:00:00.000Z",
      "modified": "2024-01-28T00:00:00.000Z"
    }
  ]
}
```

---

## 📋 기본 조회 엔드포인트

### 17. UCI 목록 조회

**엔드포인트**: `GET /api/v1/comfort-index`

**설명**: 편의성 지수 목록 조회

**파라미터**:
- `date` (필수): 날짜 (YYYY-MM-DD)
- `grade` (선택): `A` | `B` | `C` | `D` | `E` (등급 필터)
- `top_k` (선택): 상위 K개만

**요청 예시**:
```javascript
fetch('http://localhost:8000/api/v1/comfort-index?date=2024-01-28&grade=E&top_k=10')
  .then(res => res.json())
  .then(data => console.log(data));
```

**응답 예시**:
```json
[
  {
    "unit_id": "11110515",
    "date": "2024-01-28",
    "uci_score": 87.3,
    "uci_grade": "E",
    "components": { ... },
    "explain": { ... }
  }
]
```

---

## ⚠️ 에러 처리

모든 엔드포인트는 다음과 같은 형식으로 에러를 반환합니다:

```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 정보 (개발 환경에서만)"
}
```

**HTTP 상태 코드**:
- `200`: 성공
- `400`: 잘못된 요청 (파라미터 오류)
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 오류

**에러 처리 예시**:
```javascript
fetch('http://localhost:8000/api/v1/priority-queue?date=2024-01-28')
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        throw new Error(err.message);
      });
    }
    return res.json();
  })
  .then(data => console.log(data))
  .catch(error => console.error('에러:', error.message));
```

---

## 📝 중요 사항

### 1. 날짜 형식
- 모든 날짜는 **`YYYY-MM-DD`** 형식 (예: `2024-01-28`)
- 시간대는 서버 시간대 사용

### 2. 선택적 필드
- `populationSignals`, `pigeonSignals` 등은 선택적 필드
- 없어도 동작하도록 설계됨

### 3. 정렬
- 우선순위 대기열은 편의성 지수가 **높을수록** (나쁠수록) 상위에 표시
- UCI 점수는 0-100 범위, **높을수록 위험/불편 신호 강함**

### 4. 인증
- 현재는 인증 없이 접근 가능
- 추후 JWT/API Key 추가 예정

### 5. CORS
- 모든 엔드포인트는 CORS 활성화
- 개발 환경에서 모든 origin 허용

---

## 🔗 API 문서

모든 엔드포인트는 Swagger UI에서 확인 가능합니다:

**URL**: `http://localhost:8000/docs`

- 모든 엔드포인트의 상세 설명
- 요청/응답 스키마
- 실제 데이터 기반 예시 값
- 직접 테스트 가능

---

## 📞 문의

API 관련 문의사항이 있으시면 백엔드 팀에 연락해주세요.

---

**최종 업데이트**: 2024-01-28  
**API 버전**: v1  
**총 엔드포인트**: 17개

