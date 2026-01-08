import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.main import app
from app.db.mongo import mongodb
from app.core.config import settings
from httpx import AsyncClient


@pytest.fixture(scope="session")
def event_loop():
    """이벤트 루프 생성"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def db_client():
    """테스트용 MongoDB 클라이언트"""
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client.get_database()
    
    # 테스트 데이터베이스 사용
    test_db_name = "living_lab_test"
    db = client[test_db_name]
    
    yield db
    
    # 정리
    await client.drop_database(test_db_name)
    client.close()


@pytest.fixture
async def client():
    """테스트용 HTTP 클라이언트"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

