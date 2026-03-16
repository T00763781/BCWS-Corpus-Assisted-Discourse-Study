from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    app: str = "open-fireside-api"


class ConnectorExecutionRequest(BaseModel):
    connector_key: str = Field(..., description="Unique connector identifier")


class ConnectorExecutionResponse(BaseModel):
    connector_key: str
    status: str
    message: str
    stats: dict | None = None


class ConditionSummary(BaseModel):
    source_key: str
    title: str
    condition_type: str
    region: str | None = None
    payload: dict


class AnalyticsSnapshot(BaseModel):
    connector_runs: int
    condition_snapshots: int
    discourse_items: int
    actors: int
    claims: int
