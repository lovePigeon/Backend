# 3가지 데이터 통합 설계 문서

## 📋 개요

민원냠냠 프로젝트에 3가지 새로운 데이터를 추가하여 Early Warning 의사결정 도구를 강화합니다.

---

## 🎯 데이터 역할 분리

### 1️⃣ 서울특별시 강남구_쓰레기상습무단투기지역현황
**역할**: 공간 후보군 데이터 (어디를 먼저 볼 것인가)
- Priority Queue의 기본 spatial unit으로 사용
- `signals_geo` 또는 `spatial_units`에 취약도 정보로 저장

### 2️⃣ 서울특별시 강남구_쓰레기수거+현황
**역할**: 개입 정보 및 Before/After 효과 추적
- `interventions` 또는 `cleanup_logs` 컬렉션에 저장
- Before/After Tracking에만 사용

### 3️⃣ 전북특별자치도 전주시_쓰레기 불법투기 단속현황
**역할**: 시간 패턴 템플릿 데이터 (언제 문제되는가)
- 시간 패턴 정의용 (hour, day_of_week, is_night, is_weekend)
- Action Card 룰 생성용 템플릿
- 예측용이 아닌 **행동 패턴 레퍼런스**

---

## 🗂️ MongoDB 컬렉션 설계

### 1. 상습지역 데이터 → `signals_geo` 확장

**기존 구조 유지 + 필드 추가**:
```javascript
{
  _id: "unit_id",
  alley_density: Number,
  backroad_ratio: Number,
  ventilation_proxy: Number,
  accessibility_proxy: Number,
  landuse_mix: Number,
  // 신규 필드
  habitual_dumping_risk: Number,  // 0-1, 상습 무단투기 위험도
  habitual_dumping_count: Number, // 상습 지역 지정 횟수
  habitual_dumping_locations: [{  // 상습 지점 좌표
    lat: Number,
    lng: Number,
    address: String,
    risk_level: String  // "high" | "medium" | "low"
  }],
  source: String,
  raw: Object
}
```

**또는 별도 컬렉션 `habitual_dumping_areas`**:
```javascript
{
  _id: ObjectId,
  unit_id: String,  // spatial_unit과 연결
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  risk_level: String,  // "high" | "medium" | "low"
  designation_date: String,  // YYYY-MM-DD
  designation_count: Number,  // 몇 번 지정되었는지
  source: String,
  created_at: Date
}
```

**권장**: `signals_geo`에 필드 추가 (기존 구조 유지)

---

### 2. 수거 현황 데이터 → `cleanup_logs` 컬렉션 (신규)

```javascript
{
  _id: ObjectId,
  unit_id: String,  // spatial_unit과 연결
  date: String,  // YYYY-MM-DD
  cleanup_type: String,  // "regular" | "intensive" | "emergency"
  collection_frequency: Number,  // 수거 주기 (일)
  collection_amount: Number,  // 수거량 (톤/일)
  collection_rate: Number,  // 수거율 (%)
  processing_method: {
    landfill: Number,  // 매립 (톤/일)
    incineration: Number,  // 소각 (톤/일)
    recycling: Number,  // 재활용 (톤/일)
    other: Number  // 기타 (톤/일)
  },
  population_rate: Number,  // 수거지 인구율 (%)
  source: String,
  meta: Object,
  created_at: Date
}
```

**인덱스**:
- `{ unit_id: 1, date: -1 }`
- `{ date: -1 }`

**Before/After Tracking 연결**:
- `interventions`의 `intervention_type: "cleanup_intensification"`와 연결
- `cleanup_logs`의 `date`와 `interventions.start_date` 비교

---

### 3. 전주시 시간 패턴 → `time_pattern_templates` 컬렉션 (신규)

```javascript
{
  _id: ObjectId,
  pattern_type: String,  // "illegal_dumping" | "waste_complaint" | etc.
  violation_type: String,  // "담배꽁초 등 휴대쓰레기투기" | "종량제봉투 미사용" | etc.
  time_pattern: {
    hour_distribution: [Number],  // 24시간별 분포 (0-23)
    day_of_week_distribution: {  // 요일별 분포
      "월": Number,
      "화": Number,
      "수": Number,
      "목": Number,
      "금": Number,
      "토": Number,
      "일": Number
    },
    night_ratio: Number,  // 야간 비중 (20-06시)
    weekend_ratio: Number,  // 주말 비중
    peak_hours: [Number],  // 피크 시간대 (0-23)
    peak_days: [String]  // 피크 요일
  },
  sample_size: Number,  // 분석한 사건 수
  source: String,  // "jeonju_illegal_dumping"
  created_at: Date
}
```

**인덱스**:
- `{ pattern_type: 1, violation_type: 1 }`

**Action Card 연결**:
- `time_pattern_templates`의 패턴을 기반으로 Action Card 룰 생성
- 예: `night_ratio > 0.6` → "야간·주말 집중 관리 권고"

---

## 🔧 ETL 스크립트 설계

### 1. `scripts/etl_habitual_dumping_areas.js`

```javascript
// 서울특별시 강남구_쓰레기상습무단투기지역현황.xlsx 처리
// 1. XLSX 파싱
// 2. 좌표/주소 추출
// 3. unit_id 매핑 (주소 → 행정동)
// 4. signals_geo 업데이트 또는 habitual_dumping_areas 생성
```

**로직**:
- 상습 지역 좌표를 `spatial_units`와 매칭
- 매칭된 `unit_id`의 `signals_geo`에 `habitual_dumping_risk` 업데이트
- 또는 별도 `habitual_dumping_areas` 컬렉션에 저장

---

### 2. `scripts/etl_cleanup_logs.js`

```javascript
// 서울특별시 강남구_쓰레기수거+현황.csv 처리
// 1. CSV 파싱
// 2. 자치구별 데이터 추출
// 3. unit_id 매핑 (자치구 → 행정동)
// 4. cleanup_logs 컬렉션에 저장
```

**로직**:
- 시점, 자치구별, 수거량, 처리량, 처리방법 추출
- 자치구를 행정동 단위로 매핑 (또는 자치구 단위로 저장)
- `cleanup_logs` 컬렉션에 저장

---

### 3. `scripts/etl_time_pattern_templates.js`

```javascript
// 전북특별자치도 전주시_쓰레기 불법투기 단속현황.csv 처리
// 1. CSV 파싱
// 2. 위반일자, 위반시간 추출
// 3. 시간 패턴 분석 (hour, day_of_week, is_night, is_weekend)
// 4. time_pattern_templates 컬렉션에 저장
```

**로직**:
- `위반일자` → `day_of_week` 파생
- `위반시간` → `hour`, `is_night` 파생
- `위반내용` → `violation_type` 분류
- 시간별/요일별 분포 계산
- `time_pattern_templates` 컬렉션에 저장

---

## 🔗 Priority Queue / Action Card / Effect Tracking 연결

### Priority Queue 강화

**상습지역 데이터 활용**:
```javascript
// routes/priority.js 수정
// signals_geo의 habitual_dumping_risk를 UCI 계산에 반영
// 또는 Priority Queue 정렬 시 가중치 추가
```

**로직**:
- `signals_geo.habitual_dumping_risk > 0.5` → Priority Score 가중치 증가
- 상습 지역은 기본적으로 우선순위 상승

---

### Action Card 강화

**전주시 시간 패턴 템플릿 활용**:
```javascript
// routes/actionCards.js 수정
// time_pattern_templates를 조회하여 시간 기반 룰 생성
```

**로직**:
1. `time_pattern_templates`에서 `pattern_type: "illegal_dumping"` 조회
2. 템플릿의 `night_ratio`, `weekend_ratio` 확인
3. 서울 데이터의 민원 패턴과 비교
4. 유사한 패턴이면 해당 템플릿의 Action Card 생성

**예시**:
```javascript
// 템플릿: night_ratio > 0.6
// 서울 데이터: 야간 민원 비중 높음
// → Action Card: "야간·주말 집중 관리 권고"
```

---

### Effect Tracking 강화

**수거 현황 데이터 활용**:
```javascript
// routes/dashboard.js의 interventions/{id}/effect 수정
// cleanup_logs와 interventions를 연결하여 Before/After 비교
```

**로직**:
1. `interventions`에서 `intervention_type: "cleanup_intensification"` 조회
2. `cleanup_logs`에서 해당 기간의 수거량/수거율 조회
3. Before/After 비교:
   - Before: 개입 전 수거량/수거율
   - After: 개입 후 수거량/수거율
4. UCI 점수 변화와 함께 수거 현황 변화도 반환

---

## 📝 구현 우선순위

### Phase 1: 컬렉션 및 모델 생성
1. ✅ `signals_geo` 스키마 확장 (habitual_dumping_risk 필드 추가)
2. ✅ `cleanup_logs` 모델 생성
3. ✅ `time_pattern_templates` 모델 생성

### Phase 2: ETL 스크립트
4. ✅ `etl_habitual_dumping_areas.js` 작성
5. ✅ `etl_cleanup_logs.js` 작성
6. ✅ `etl_time_pattern_templates.js` 작성

### Phase 3: 연결 및 통합
7. ✅ Priority Queue에 상습지역 가중치 반영
8. ✅ Action Card에 시간 패턴 템플릿 적용
9. ✅ Effect Tracking에 수거 현황 데이터 연결

---

## 🎯 핵심 원칙

1. **역할 분리**: 각 데이터는 서로를 대체하지 않고 조합됨
2. **템플릿 기반**: 전주시 데이터는 예측용이 아닌 패턴 레퍼런스
3. **공간 우선순위**: 상습지역 데이터는 공간 후보군으로만 사용
4. **효과 검증**: 수거 현황은 Before/After Tracking에만 사용

---

## 📌 다음 단계

1. 모델 생성
2. ETL 스크립트 작성
3. Priority Queue / Action Card / Effect Tracking 수정
4. 테스트 및 검증

