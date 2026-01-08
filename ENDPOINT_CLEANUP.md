# 엔드포인트 정리 제안

## 중복 엔드포인트

### 1. Interventions 조회 중복
- ❌ `GET /api/v1/interventions` (interventions.js)
- ✅ `GET /api/v1/dashboard/interventions` (dashboard.js) - **유지** (progress, status, count 포함)

**결론**: interventions.js의 GET 제거, dashboard 버전 사용

### 2. Tracking/Effect 중복
- ❌ `GET /api/v1/interventions/{id}/tracking` (interventions.js)
- ✅ `GET /api/v1/dashboard/interventions/{id}/effect` (dashboard.js) - **유지** (improvement, effect_size 포함)

**결론**: interventions.js의 tracking 제거, dashboard 버전 사용

### 3. 불필요한 파일
- ❌ `routes/swagger-annotations.js` - 참고용 파일, 실제로 사용 안 함

## 유지할 엔드포인트

### 필수
- `POST /api/v1/interventions` - 생성용 (필요)
- `GET /api/v1/dashboard/interventions` - 조회용 (더 많은 정보)
- `GET /api/v1/dashboard/interventions/{id}/effect` - 효과 분석 (더 상세)

### 나머지
- 모든 다른 엔드포인트는 필요함

