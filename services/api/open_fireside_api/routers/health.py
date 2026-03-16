from fastapi import APIRouter

from open_fireside_api.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse()
