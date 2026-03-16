from fastapi import APIRouter

from open_fireside_api.schemas import AnalyticsSnapshot
from open_fireside_api.services.queries import analytics_snapshot

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/snapshot", response_model=AnalyticsSnapshot)
def get_analytics_snapshot() -> AnalyticsSnapshot:
    return AnalyticsSnapshot(**analytics_snapshot())
