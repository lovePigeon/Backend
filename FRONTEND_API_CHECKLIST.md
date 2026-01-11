# 프론트엔드 API 체크리스트

## ✅ 완료된 엔드포인트

### 공개 뷰 (PublicView)
- ✅ `GET /api/v1/dashboard/trends` - 분기별 추세 지표
- ✅ `GET /api/v1/dashboard/regional-trends` - 지역별 현황
- ✅ `GET /api/v1/dashboard/human-signal` - 민원 데이터 (시간대별 패턴 포함)
- ✅ `GET /api/v1/dashboard/population-signal` - 생활인구 데이터
- ✅ `GET /api/v1/dashboard/uci` - 편의성 지수
- ✅ `GET /api/v1/dashboard/interventions` - 개선 현황
- ✅ `GET /api/v1/geo/comfort-index.geojson` - GeoJSON 형식

### 관리자 대시보드 (AdminDashboard)
- ✅ `GET /api/v1/priority-queue` - 우선순위 대기열
- ✅ `GET /api/v1/comfort-index/{unitId}` - 단위별 편의성 지수
- ✅ `GET /api/v1/dashboard/blind-spots` - 사각지대 탐지
- ✅ `GET /api/v1/dashboard/time-pattern` - 시간대별 패턴 분석
- ✅ `GET /api/v1/action-cards` - 개입 권고사항
- ✅ `GET /api/v1/dashboard/interventions/{interventionId}/effect` - 개입 효과

## 📝 추가된 기능

### 1. 시간대별 패턴 (human-signal)
- `by_hour`: 시간대별 민원 집계 (0-23시)
- `hour_pattern`: 24시간 패턴 배열

### 2. 분기별 추세 (trends)
- 분기별 도시 전체 편의성 지수
- 전 분기 대비 개선 점수

### 3. 지역별 현황 (regional-trends)
- 구 단위 집계
- 위도/경도 좌표
- 추세 상태 (improving/stable/monitoring/attention)

### 4. 시간대별 패턴 분석 (time-pattern)
- 24시간 민원 패턴
- 요일별 패턴
- 피크 시간대
- 권장 관리 시간

### 5. 사각지대 탐지 (blind-spots)
- 신호 간 불일치 분석
- 위험도 레벨 (high/medium/low)
- 탐지 이유 및 권고 조치

## ⚠️ 선택적 기능 (비둘기 신호)

비둘기 신호는 선택적 기능입니다. 현재 모델이 없지만, 필요시 추가 가능:
- `PigeonSignal` 모델 생성
- `GET /api/v1/dashboard/pigeon-signal` 엔드포인트 추가

## 🔄 데이터 형식

모든 엔드포인트는 프론트엔드 요구사항 문서에 명시된 형식과 호환됩니다:
- 날짜: `YYYY-MM-DD`
- 분기: `YYYY QN`
- 상태: Enum 값 사용
- 좌표: lat/lng 형식

## 📚 API 문서

모든 엔드포인트는 `/docs`에서 확인 가능하며, 예시 값이 포함되어 있습니다.

