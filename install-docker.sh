#!/bin/bash

echo "🐳 Docker 설치 스크립트"
echo ""

# macOS인지 확인
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "이 스크립트는 macOS용입니다."
    exit 1
fi

# Homebrew 확인
if ! command -v brew &> /dev/null; then
    echo "Homebrew가 설치되어 있지 않습니다."
    echo "Homebrew 설치: https://brew.sh"
    exit 1
fi

echo "Docker Desktop 설치 중..."
brew install --cask docker

echo ""
echo "✅ Docker Desktop이 설치되었습니다!"
echo ""
echo "다음 단계:"
echo "1. Applications 폴더에서 Docker Desktop을 실행하세요"
echo "2. Docker Desktop이 완전히 시작될 때까지 기다리세요 (메뉴바에 Docker 아이콘 표시)"
echo "3. 터미널을 재시작하거나 새 터미널을 여세요"
echo "4. 다음 명령어로 서버를 시작하세요:"
echo "   cd /Users/iyunji/Desktop/리빙랩"
echo "   docker-compose up -d"

