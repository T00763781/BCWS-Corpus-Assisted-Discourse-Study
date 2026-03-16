from fastapi import APIRouter

from open_fireside_api.schemas import EnvironmentOverview
from open_fireside_api.services.queries import environment_overview

router = APIRouter(prefix="/environment", tags=["environment"])


@router.get("/overview", response_model=EnvironmentOverview)
def get_environment_overview() -> EnvironmentOverview:
    return EnvironmentOverview(**environment_overview())
