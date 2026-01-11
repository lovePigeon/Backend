from typing import List, Optional
from app.db.mongo import mongodb
from app.models.schemas import TrackingResponse, TrackingDataPoint, ComfortIndexComponents, Intervention
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


async def get_tracking(
    intervention_id: str,
    baseline_weeks: int = 4,
    followup_weeks: int = 4
) -> Optional[TrackingResponse]:
    """Before/After Tracking 조회"""
    from bson import ObjectId
    
    db = mongodb.db
    
    # Intervention 조회
    intervention_doc = await db.interventions.find_one({"_id": ObjectId(intervention_id)})
    if not intervention_doc:
        return None
    
    intervention = Intervention(**intervention_doc)
    unit_id = intervention.unit_id
    start_date = datetime.strptime(intervention.start_date, "%Y-%m-%d")
    
    # Baseline 기간
    baseline_start = start_date - timedelta(weeks=baseline_weeks)
    baseline_end = start_date - timedelta(days=1)
    
    # Followup 기간
    followup_start = start_date
    if intervention.end_date:
        followup_end = datetime.strptime(intervention.end_date, "%Y-%m-%d")
    else:
        followup_end = datetime.now()
    
    # 최대 followup_weeks로 제한
    max_followup_end = start_date + timedelta(weeks=followup_weeks)
    if followup_end > max_followup_end:
        followup_end = max_followup_end
    
    # Baseline 기간의 comfort_index 조회
    baseline_cursor = db.comfort_index.find({
        "unit_id": unit_id,
        "date": {
            "$gte": baseline_start.strftime("%Y-%m-%d"),
            "$lte": baseline_end.strftime("%Y-%m-%d")
        }
    }).sort("date", 1)
    baseline_data = await baseline_cursor.to_list(length=None)
    
    # Followup 기간의 comfort_index 조회
    followup_cursor = db.comfort_index.find({
        "unit_id": unit_id,
        "date": {
            "$gte": followup_start.strftime("%Y-%m-%d"),
            "$lte": followup_end.strftime("%Y-%m-%d")
        }
    }).sort("date", 1)
    followup_data = await followup_cursor.to_list(length=None)
    
    # TrackingDataPoint로 변환
    baseline_points = [
        TrackingDataPoint(
            date=d["date"],
            uci_score=d.get("uci_score"),
            components=_convert_components(d.get("components", {}))
        )
        for d in baseline_data
    ]
    
    followup_points = [
        TrackingDataPoint(
            date=d["date"],
            uci_score=d.get("uci_score"),
            components=_convert_components(d.get("components", {}))
        )
        for d in followup_data
    ]
    
    return TrackingResponse(
        intervention_id=intervention_id,
        unit_id=unit_id,
        baseline_period=baseline_points,
        followup_period=followup_points,
        intervention=intervention
    )


def _convert_components(components_dict: dict) -> Optional[ComfortIndexComponents]:
    """dict를 ComfortIndexComponents로 변환"""
    if not components_dict:
        return None
    
    return ComfortIndexComponents(
        human_score=components_dict.get("human_score"),
        geo_score=components_dict.get("geo_score"),
        population_score=components_dict.get("population_score"),
        pigeon_score=components_dict.get("pigeon_score"),
        human_normalized=components_dict.get("human_normalized"),
        geo_normalized=components_dict.get("geo_normalized"),
        population_normalized=components_dict.get("population_normalized"),
        pigeon_normalized=components_dict.get("pigeon_normalized"),
        weights=components_dict.get("weights", {})
    )

