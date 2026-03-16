from fastapi import APIRouter, HTTPException

from open_fireside_api.schemas import ConnectorExecutionRequest, ConnectorExecutionResponse
from open_fireside_api.services.registry import CONNECTORS

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("", response_model=list[str])
def list_connectors() -> list[str]:
    return sorted(CONNECTORS.keys())


@router.post("/run", response_model=ConnectorExecutionResponse)
def run_connector(request: ConnectorExecutionRequest) -> ConnectorExecutionResponse:
    connector = CONNECTORS.get(request.connector_key)
    if connector is None:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {request.connector_key}")
    result = connector.run()
    return ConnectorExecutionResponse(connector_key=request.connector_key, status=result.status, message=result.message, stats=result.stats)
