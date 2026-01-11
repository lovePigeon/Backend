import pytest
from datetime import datetime, timedelta
from app.services.uci_compute import compute_uci_for_unit
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_uci_compute_with_data(db_client):
    """UCI 계산 테스트 (데이터가 있는 경우)"""
    # 테스트 데이터 생성
    unit_id = "TEST_UNIT_001"
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Spatial unit 생성
    await db_client.spatial_units.insert_one({
        "_id": unit_id,
        "name": "테스트동",
        "geom": {
            "type": "Polygon",
            "coordinates": [[[126.0, 37.0], [126.1, 37.0], [126.1, 37.1], [126.0, 37.1], [126.0, 37.0]]]
        },
        "meta": {}
    })
    
    # Human signals 생성
    for i in range(28):
        date = (datetime.now() - timedelta(days=27-i)).strftime("%Y-%m-%d")
        await db_client.signals_human.insert_one({
            "unit_id": unit_id,
            "date": date,
            "complaint_total": 5 + i % 3,
            "complaint_odor": 2,
            "complaint_trash": 2,
            "night_ratio": 0.6,
            "repeat_ratio": 0.5,
            "source": "test",
            "raw": {}
        })
    
    # Geo signals 생성
    await db_client.signals_geo.insert_one({
        "_id": unit_id,
        "alley_density": 60,
        "backroad_ratio": 0.6,
        "ventilation_proxy": 5,
        "accessibility_proxy": 4,
        "landuse_mix": 0.5,
        "source": "test",
        "raw": {}
    })
    
    # Population signals 생성
    for i in range(28):
        date = (datetime.now() - timedelta(days=27-i)).strftime("%Y-%m-%d")
        await db_client.signals_population.insert_one({
            "unit_id": unit_id,
            "date": date,
            "pop_total": 10000,
            "pop_night": 2000,
            "pop_change_rate": 0.1,
            "source": "test",
            "raw": {}
        })
    
    # 원래 db를 임시로 교체
    original_db = mongodb.db
    mongodb.db = db_client
    
    try:
        # UCI 계산
        result = await compute_uci_for_unit(
            unit_id=unit_id,
            date=today,
            window_weeks=4,
            use_pigeon=False
        )
        
        assert result is not None
        assert result.unit_id == unit_id
        assert 0 <= result.uci_score <= 100
        assert result.uci_grade in ["A", "B", "C", "D", "E"]
        assert result.components is not None
        assert result.explain is not None
        assert result.explain.why_summary != ""
        
    finally:
        mongodb.db = original_db


@pytest.mark.asyncio
async def test_uci_compute_no_data(db_client):
    """UCI 계산 테스트 (데이터가 없는 경우)"""
    unit_id = "TEST_UNIT_002"
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Spatial unit만 생성
    await db_client.spatial_units.insert_one({
        "_id": unit_id,
        "name": "테스트동2",
        "geom": {
            "type": "Polygon",
            "coordinates": [[[126.0, 37.0], [126.1, 37.0], [126.1, 37.1], [126.0, 37.1], [126.0, 37.0]]]
        },
        "meta": {}
    })
    
    original_db = mongodb.db
    mongodb.db = db_client
    
    try:
        result = await compute_uci_for_unit(
            unit_id=unit_id,
            date=today,
            window_weeks=4,
            use_pigeon=False
        )
        
        # 데이터가 없으면 None 반환
        assert result is None
        
    finally:
        mongodb.db = original_db

