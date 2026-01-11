# MongoDB Atlas 연결 설정

## 현재 설정

MongoDB Atlas 클러스터에 연결하도록 설정되어 있습니다.

## 연결 정보

- **User**: syralee1004
- **Cluster**: cluster0.qbfefdi.mongodb.net
- **Database**: living_lab

## 환경 변수

`.env` 파일에 다음 정보가 설정되어 있습니다:

```env
MONGODB_USER=syralee1004
MONGODB_PASSWORD=jesus020429
MONGODB_CLUSTER=cluster0.qbfefdi.mongodb.net
MONGODB_DATABASE=living_lab
```

## 연결 테스트

```bash
# 서버 실행
npm run dev

# 연결 확인
curl http://localhost:8000/api/v1/health
```

## 주의사항

1. **비밀번호 보안**: `.env` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.
2. **IP 화이트리스트**: MongoDB Atlas에서 현재 IP 주소를 화이트리스트에 추가해야 할 수 있습니다.
3. **네트워크 액세스**: MongoDB Atlas 대시보드에서 "Network Access"에서 IP를 추가하세요.

## IP 화이트리스트 추가 방법

1. MongoDB Atlas 대시보드 접속
2. "Network Access" 메뉴 클릭
3. "Add IP Address" 클릭
4. "Allow Access from Anywhere" (0.0.0.0/0) 선택 또는 현재 IP 입력
5. "Confirm" 클릭

## 로컬 MongoDB로 변경하려면

`.env` 파일에서 다음으로 변경:

```env
MONGODB_URI=mongodb://localhost:27017/living_lab
```

