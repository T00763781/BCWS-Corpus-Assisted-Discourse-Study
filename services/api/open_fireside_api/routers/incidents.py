from fastapi import APIRouter, HTTPException

from open_fireside_api.schemas import IncidentDetail, IncidentSummary
from open_fireside_api.services.queries import incident_detail, list_incidents

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentSummary])
def get_incidents() -> list[IncidentSummary]:
    return [IncidentSummary(**row) for row in list_incidents()]


@router.get("/{fire_number}", response_model=IncidentDetail)
def get_incident_detail(fire_number: str) -> IncidentDetail:
    detail = incident_detail(fire_number)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Unknown incident: {fire_number}")
    return IncidentDetail(**detail)
