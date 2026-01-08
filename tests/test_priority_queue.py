import pytest
from datetime import datetime
from app.services.priority_service import get_priority_queue
from motor.motor_asyncio import AsyncIOMotorClient
from app.db.mongo import mongodb


@pytest.mark.asyncio
async def test_priority_queue(db_client):
    """Priority Queue 테스트"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Spatial units 생성
    unit_ids = ["TEST_001", "TEST_002", "TEST_003"]
    for unit_id in unit_ids:
        await db_client.spatial_units.insert_one({
            "_id": unit_id,
            "name": f"테스트동{unit_id[-1]}",
            "geom": {
                "type": "Polygon",
                "coordinates": [[[126.0, 37.0], [126.1, 37.0], [126.1, 37.1], [126.0, 37.1], [126.0, 37.0]]]
            },
            "meta": {}
        })
    
    # Comfort indices 생성 (점수 순서대로)
    await db_client.comfort_index.insert_many([
        {
            "unit_id": "TEST_001",
            "date": today,
            "uci_score": 85.0,
            "uci_grade": "E",
            "components": {},
            "explain": {
                "why_summary": "높은 위험",
                "key_drivers": [{"signal": "test", "value": 0.8}]
            },
            "created_at": datetime.now()
        },
        {
            "unit_id": "TEST_002",
            "date": today,
            "uci_score": 60.0,
            "uci_grade": "D",
            "components": {},
            "explain": {
                "why_summary": "중간 위험",
                "key_drivers": [{"signal": "test", "value": 0.6}]
            },
            "created_at": datetime.now()
        },
        {
            "unit_id": "TEST_003",
            "date": today,
            "uci_score": 30.0,
            "uci_grade": "B",
            "components": {},
            "explain": {
                "why_summary": "낮은 위험",
                "key_drivers": [{"signal": "test", "value": 0.3}]
            },
            "created_at": datetime.now()
        }
    ])
    
    original_db = mongodb.db
    mongodb.db = db_client
    
    try:
        results = await get_priority_queue(date=today, top_n=10)
        
        assert len(results) == 3
        assert results[0].rank == 1
        assert results[0].uci_score == 85.0
        assert results[0].uci_grade == "E"
        assert results[1].uci_score == 60.0
        assert results[2].uci_score == 30.0
        
        # 정렬 확인 (높은 점수 순)
        assert results[0].uci_score >= results[1].uci_score >= results[2].uci_score
        
    finally:
        mongodb.db = original_db

