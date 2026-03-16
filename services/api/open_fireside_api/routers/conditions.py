from fastapi import APIRouter

from open_fireside_api.schemas import ConditionSummary
from open_fireside_api.services.queries import latest_conditions

router = APIRouter(prefix="/conditions", tags=["conditions"])


@router.get("", response_model=list[ConditionSummary])
def get_conditions() -> list[ConditionSummary]:
    rows = latest_conditions()
    return [ConditionSummary(source_key=row.source_key, title=row.title, condition_type=row.condition_type, region=row.region, payload=row.payload) for row in rows]
