import pytest
from datetime import datetime
from app.api.routes.geo import get_comfort_index_geojson
from motor.motor_asyncio import AsyncIOMotorClient
from app.db.mongo import mongodb


@pytest.mark.asyncio
async def test_comfort_index_geojson(db_client):
    """Comfort Index GeoJSON 테스트"""
    today = datetime.now().strftime("%Y-%m-%d")
    unit_id = "TEST_GEO_001"
    
    # Spatial unit 생성 (GeoJSON 포함)
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
    
    original_db = mongodb.db
    mongodb.db = db_client
    
    try:
        geojson = await get_comfort_index_geojson(date=today)
        
        assert geojson["type"] == "FeatureCollection"
        assert "features" in geojson
        assert len(geojson["features"]) > 0
        
        feature = geojson["features"][0]
        assert feature["type"] == "Feature"
        assert "geometry" in feature
        assert "properties" in feature
        assert feature["properties"]["unit_id"] == unit_id
        assert feature["properties"]["uci_score"] == 75.0
        assert feature["properties"]["uci_grade"] == "D"
        
    finally:
        mongodb.db = original_db

