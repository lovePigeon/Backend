# 우선순위 큐 API 빈 응답 문제 해결

## 🔍 문제 원인

### 1. 날짜 불일치
- **DB에 있는 데이터**: `2023-01-01`
- **프론트엔드 요청 날짜**: `2026-01-09` (미래 날짜)
- **결과**: 해당 날짜에 데이터가 없어 빈 배열 `[]` 반환

### 2. 응답 형식
- 현재 코드는 빈 배열 `[]`을 반환
- 프론트엔드가 이를 "데이터 없음"으로 판단

## ✅ 해결 방법

### 1. 자동 최신 날짜 조회
`date` 파라미터가 없거나 해당 날짜에 데이터가 없으면, **자동으로 최신 날짜의 데이터를 반환**하도록 수정했습니다.

### 2. 수정된 코드

#### `routes/priority.js`
```javascript
router.get('/', async (req, res) => {
  try {
    const { date, top_n = 20 } = req.query;

    // 날짜가 없거나 해당 날짜에 데이터가 없으면 최신 날짜 사용
    let targetDate = date;
    let comfortIndices = [];

    if (targetDate) {
      comfortIndices = await ComfortIndex.find({ date: targetDate })
        .sort({ uci_score: -1 })
        .limit(parseInt(top_n));
    }

    // 해당 날짜에 데이터가 없으면 최신 날짜 조회
    if (!targetDate || comfortIndices.length === 0) {
      const latestComfortIndex = await ComfortIndex.findOne()
        .sort({ date: -1 });
      
      if (latestComfortIndex) {
        targetDate = latestComfortIndex.date;
        comfortIndices = await ComfortIndex.find({ date: targetDate })
          .sort({ uci_score: -1 })
          .limit(parseInt(top_n));
      }
    }

    // 데이터가 없으면 빈 배열 반환
    if (comfortIndices.length === 0) {
      return res.json([]);
    }

    // ... 나머지 로직
  }
});
```

#### `routes/comfortIndex.js`
동일한 로직 적용: `date`가 없으면 최신 날짜 자동 조회

## 📊 현재 데이터 상태

```
총 개수: 22개
최신 날짜: 2023-01-01
해당 날짜 데이터: 22개
```

## 🧪 테스트 방법

### 1. 날짜 없이 요청 (최신 날짜 자동 조회)
```bash
curl "http://localhost:8000/api/v1/priority-queue?top_n=20"
```

### 2. 존재하지 않는 날짜 요청 (최신 날짜로 fallback)
```bash
curl "http://localhost:8000/api/v1/priority-queue?date=2026-01-09&top_n=20"
```

### 3. 실제 데이터가 있는 날짜 요청
```bash
curl "http://localhost:8000/api/v1/priority-queue?date=2023-01-01&top_n=20"
```

## 📝 응답 형식

### 성공 시 (데이터 있음)
```json
[
  {
    "rank": 1,
    "unit_id": "11110500",
    "name": "지역1",
    "uci_score": 26.4,
    "uci_grade": "B",
    "why_summary": "최근 4주간 신호 분석",
    "key_drivers": []
  },
  ...
]
```

### 데이터 없음
```json
[]
```

## 🔄 다음 단계

### 1. 최신 데이터 생성 (권장)
현재 데이터가 `2023-01-01`이므로, 최신 날짜의 데이터를 생성해야 합니다:

```bash
# 1. 최신 signals_human 데이터 확인
# 2. UCI 재계산
npm run compute-uci

# 3. Priority Queue 확인
npm run priority
```

### 2. 프론트엔드 수정 (선택)
프론트엔드에서도 빈 배열을 처리할 수 있도록 로직 추가:

```typescript
const response = await fetch(`/api/v1/priority-queue?date=${date}&top_n=20`);
const data = await response.json();

if (Array.isArray(data) && data.length > 0) {
  // 데이터 있음
  setQueueItems(data);
} else {
  // 데이터 없음 또는 빈 배열
  setQueueItems([]);
  // 또는 최신 날짜로 재시도
}
```

## ✅ 해결 완료

- ✅ `date` 파라미터 없을 때 최신 날짜 자동 조회
- ✅ 존재하지 않는 날짜 요청 시 최신 날짜로 fallback
- ✅ 빈 배열 반환 (프론트엔드 호환)

이제 프론트엔드에서 어떤 날짜를 요청하더라도, 최신 데이터가 있으면 자동으로 반환됩니다.

