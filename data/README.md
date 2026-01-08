# 데이터 디렉토리

## 구조

- `raw/` - 원본 CSV 파일들 (업로드된 원본 데이터)
- `processed/` - 처리된 데이터 (정제/변환된 데이터)
- `uploads/` - API를 통해 업로드된 파일들

## 사용 방법

### 1. 직접 파일 복사

```bash
# CSV 파일을 raw 디렉토리에 복사
cp your_data.csv data/raw/
```

### 2. API를 통한 업로드

```bash
curl -X POST http://localhost:8000/api/v1/data/upload \
  -F "file=@your_data.csv" \
  -F "type=raw"
```

## 권장 파일명 규칙

- `signals_human_YYYYMMDD.csv` - 민원 데이터
- `signals_population_YYYYMMDD.csv` - 생활인구 데이터
- `spatial_units.csv` - 공간 단위 데이터
- `signals_geo.csv` - 지리적 취약성 데이터

