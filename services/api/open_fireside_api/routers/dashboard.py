from fastapi import APIRouter

from open_fireside_api.schemas import DashboardOverview
from open_fireside_api.services.queries import dashboard_overview

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def get_dashboard_overview() -> DashboardOverview:
    return DashboardOverview(**dashboard_overview())
