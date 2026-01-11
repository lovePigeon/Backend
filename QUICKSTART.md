# 빠른 시작 가이드 (Node.js 버전)

## 1. Docker 설치 (아직 설치하지 않았다면)

```bash
# 방법 1: 스크립트 사용
./install-docker.sh

# 방법 2: 수동 설치
# https://www.docker.com/products/docker-desktop 에서 다운로드
```

## 2. Docker Desktop 실행

1. Applications 폴더에서 Docker Desktop 실행
2. 메뉴바에 Docker 아이콘이 나타날 때까지 대기
3. 터미널 재시작 또는 새 터미널 열기

## 3. 서버 시작

```bash
# Docker Compose로 MongoDB + API 동시 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 중지
docker-compose down
```

## 4. 더미 데이터 시드

```bash
# Docker Compose 사용 시
docker-compose exec api npm run seed

# 또는 로컬 실행 시 (MongoDB가 실행 중이어야 함)
npm run seed
```

## 5. API 테스트

브라우저에서 열기:
- Health Check: http://localhost:8000/api/v1/health
- 루트: http://localhost:8000/

## 6. UCI 계산 실행

```bash
curl -X POST http://localhost:8000/api/v1/comfort-index/compute \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-08", "window_weeks": 4, "use_pigeon": false}'
```

## 7. Priority Queue 조회

```bash
curl "http://localhost:8000/api/v1/priority-queue?date=2026-01-08&top_n=20"
```

## 문제 해결

### Docker 명령어를 찾을 수 없을 때

1. Docker Desktop이 실행 중인지 확인
2. 터미널을 재시작하거나 새 터미널 열기
3. 또는 전체 경로 사용:
   ```bash
   /usr/local/bin/docker-compose up -d
   ```

### MongoDB 연결 오류

`.env` 파일이 있는지 확인하고, MongoDB URI가 올바른지 확인:
```
MONGODB_URI=mongodb://localhost:27017/living_lab
```

### Node.js 모듈 오류

```bash
npm install
```
