from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from app.db.mongo import mongodb
from app.models.schemas import Intervention, InterventionCreate, TrackingResponse
from app.services.tracking_service import get_tracking
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

router = APIRouter()


@router.post("", response_model=Intervention)
async def create_intervention(intervention: InterventionCreate):
    """Intervention 생성"""
    db = mongodb.db
    
    doc = intervention.model_dump()
    doc["created_at"] = datetime.now()
    
    result = await db.interventions.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    
    # datetime을 ISO 형식으로 변환
    if isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    
    return Intervention(**doc)


@router.get("", response_model=List[Intervention])
async def get_interventions(
    unit_id: Optional[str] = Query(None, description="unit_id 필터")
):
    """Interventions 조회"""
    db = mongodb.db
    
    query = {}
    if unit_id:
        query["unit_id"] = unit_id
    
    cursor = db.interventions.find(query).sort("start_date", -1)
    results = await cursor.to_list(length=100)
    
    # ObjectId와 datetime 처리
    for r in results:
        r["_id"] = str(r["_id"])
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"]
    
    return [Intervention(**r) for r in results]


@router.get("/{intervention_id}/tracking", response_model=TrackingResponse)
async def get_intervention_tracking(
    intervention_id: str,
    baseline_weeks: int = Query(4, ge=1, le=12),
    followup_weeks: int = Query(4, ge=1, le=12)
):
    """Intervention의 Before/After Tracking"""
    # ObjectId 유효성 검사
    try:
        ObjectId(intervention_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid intervention_id format")
    
    result = await get_tracking(
        intervention_id=intervention_id,
        baseline_weeks=baseline_weeks,
        followup_weeks=followup_weeks
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Intervention not found")
    
    return result

