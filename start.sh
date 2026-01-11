#!/bin/bash
echo "민원냠냠 Core Engine 시작 중..."

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker를 찾을 수 없습니다."
    echo "Docker Desktop을 실행하고 터미널을 재시작하세요."
    exit 1
fi

# Docker Compose로 시작
echo "📦 Docker Compose로 서비스 시작..."
docker-compose up -d

echo "✅ 서비스가 시작되었습니다!"
echo ""
echo "📚 API 문서: http://localhost:8000/docs"
echo "🏥 Health Check: http://localhost:8000/api/v1/health"
echo ""
echo "더미 데이터 시드:"
echo "  docker-compose exec api python scripts/seed_demo_data.py"
echo ""
echo "로그 확인:"
echo "  docker-compose logs -f api"
