import pytest
from datetime import datetime, timedelta
from app.services.action_cards_service import generate_action_cards
from motor.motor_asyncio import AsyncIOMotorClient
from app.db.mongo import mongodb


@pytest.mark.asyncio
async def test_action_cards_generation(db_client):
    """Action Cards 생성 테스트"""
    today = datetime.now().strftime("%Y-%m-%d")
    unit_id = "TEST_AC_001"
    
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
    
    # Comfort index 생성
    await db_client.comfort_index.insert_one({
        "unit_id": unit_id,
        "date": today,
        "uci_score": 75.0,
        "uci_grade": "D",
        "components": {},
        "explain": {
            "why_summary": "테스트",
            "key_drivers": []
        },
        "created_at": datetime.now()
    })
    
    # Human signals 생성 (야간 집중도 높음)
    for i in range(28):
        date = (datetime.now() - timedelta(days=27-i)).strftime("%Y-%m-%d")
        await db_client.signals_human.insert_one({
            "unit_id": unit_id,
            "date": date,
            "complaint_total": 5,
            "complaint_odor": 2,
            "night_ratio": 0.7,  # 높은 야간 비율
            "repeat_ratio": 0.6,
            "source": "test",
            "raw": {}
        })
    
    # Geo signals 생성
    await db_client.signals_geo.insert_one({
        "_id": unit_id,
        "alley_density": 70,
        "backroad_ratio": 0.7,
        "ventilation_proxy": 6,
        "accessibility_proxy": 5,
        "landuse_mix": 0.5,
        "source": "test",
        "raw": {}
    })
    
    original_db = mongodb.db
    mongodb.db = db_client
    
    try:
        cards = await generate_action_cards(
            date=today,
            unit_ids=[unit_id],
            use_pigeon=False
        )
        
        assert len(cards) > 0
        card = cards[0]
        
        # 필수 필드 확인
        assert card.card_id is not None
        assert card.unit_id == unit_id
        assert card.date == today
        assert card.title != ""
        assert card.why != ""
        assert len(card.recommended_actions) > 0
        assert len(card.tags) >= 0
        assert 0 <= card.confidence <= 1
        assert len(card.limitations) >= 0
        
    finally:
        mongodb.db = original_db

