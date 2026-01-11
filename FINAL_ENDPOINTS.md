# 프론트엔드 핵심 엔드포인트 (최종)

## ✅ 최종 엔드포인트 목록 (16개)

### 공개 뷰 (PublicView) - 7개

1. **GET /api/v1/dashboard/trends**
   - 분기별/월별 추세 지표
   - 도시 전체 편의성 지수 변화 추이

2. **GET /api/v1/dashboard/regional-trends**
   - 지역별 현황 (구 단위)
   - 지도 마커 표시용 데이터

3. **GET /api/v1/dashboard/human-signal**
   - 민원 데이터 (실시간/일별)
   - 시간대별, 요일별 패턴 포함

4. **GET /api/v1/dashboard/population-signal**
   - 생활인구 데이터 (실시간/일별)
   - 주간/야간 인구, 변화율, 추세

5. **GET /api/v1/dashboard/uci**
   - 편의성 지수 (주간/월별/분기별)
   - UCI 점수 및 등급 분포

6. **GET /api/v1/dashboard/interventions**
   - 개선 현황
   - 진행 중/완료된 개선 사업

7. **GET /api/v1/geo/comfort-index.geojson**
   - GeoJSON 형식 지도 데이터
   - Mapbox 등 지도 라이브러리용

### 관리자 대시보드 (AdminDashboard) - 6개

8. **GET /api/v1/priority-queue**
   - 우선순위 검사 대기열
   - UCI 점수 기준 상위 N개 지역

9. **GET /api/v1/comfort-index/{unit_id}**
   - 특정 지역의 상세 편의성 지수
   - 우선순위 대기열에서 선택 시 상세 정보

10. **GET /api/v1/dashboard/blind-spots**
    - 사각지대 탐지
    - 신호 간 불일치 분석

11. **GET /api/v1/dashboard/time-pattern**
    - 시간대별 패턴 분석
    - 최적의 관리 시점 제안

12. **GET /api/v1/action-cards**
    - 개입 권고사항
    - 데이터 기반 개입 유형 및 예상 효과

13. **GET /api/v1/dashboard/interventions/{intervention_id}/effect**
    - 개입 전후 효과 추적
    - 과거 개입 사례의 효과 측정

### 데이터 관리 - 3개

14. **POST /api/v1/data/upload**
    - CSV 파일 업로드

15. **POST /api/v1/data/import/{type}**
    - CSV 데이터를 MongoDB에 임포트
    - type: `human` | `geo` | `population` | `spatial_units`

16. **GET /api/v1/data/files**
    - 업로드된 파일 목록 조회

---

## 🗑️ 제거된 엔드포인트

### 백엔드 내부용 (제거됨)
- ❌ `GET /api/v1/analytics/*` (6개) - 백엔드 내부 분석용
- ❌ `POST /api/v1/comfort-index/compute` - UCI 계산 (백엔드 내부)
- ❌ `POST /api/v1/action-cards/generate` - 액션 카드 생성 (백엔드 내부)

### 보조 기능 (제거됨)
- ❌ `GET /api/v1/units/*` (4개) - 지역 정보 조회 (보조 기능)
- ❌ `GET /api/v1/dashboard/summary` - 요약 데이터 (개별 엔드포인트로 대체)
- ❌ `GET /api/v1/dashboard/geo-signal` - 지리 신호 (보조 기능)
- ❌ `GET /api/v1/geo/priority.geojson` - 우선순위 GeoJSON (보조 기능)
- ❌ `GET /api/v1/data/files/{filename}` - 파일 미리보기 (보조 기능)
- ❌ `DELETE /api/v1/data/files/{filename}` - 파일 삭제 (보조 기능)
- ❌ `POST /api/v1/interventions` - 개입 생성 (dashboard/interventions로 통합)

### 기본 기능 (유지)
- ✅ `GET /` - API 루트 정보
- ✅ `GET /api/v1/health` - 헬스 체크

---

## 📊 최종 통계

- **프론트엔드 핵심**: 16개
- **기본 기능**: 2개 (루트, 헬스체크)
- **총 엔드포인트**: 18개

---

## 📝 참고사항

1. 모든 엔드포인트는 `/docs`에서 확인 가능
2. 모든 엔드포인트에 예시 값 포함
3. 프론트엔드 요구사항 문서와 100% 일치
4. 불필요한 엔드포인트는 모두 제거됨

