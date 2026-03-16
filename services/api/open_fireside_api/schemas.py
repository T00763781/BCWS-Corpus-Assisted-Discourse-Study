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


class FireCentreOverview(BaseModel):
    fire_centre: str
    incident_count: int
    out_of_control: int
    being_held: int
    under_control: int


class DashboardIncidentSummary(BaseModel):
    fire_number: str
    wildfire_name: str
    stage_of_control: str
    fire_centre: str | None = None
    size_hectares: float | None = None
    updated_at: str | None = None


class DashboardOverview(BaseModel):
    active_incidents: int
    out_of_control: int
    being_held: int
    under_control: int
    evacuation_orders: int
    evacuation_alerts: int
    area_restrictions: int
    fire_centres: list[FireCentreOverview]
    pinned_incidents: list[DashboardIncidentSummary]


class IncidentSummary(BaseModel):
    fire_number: str
    wildfire_name: str
    stage_of_control: str
    fire_centre: str | None = None
    location_summary: str | None = None
    discovered_at: str | None = None
    updated_at: str | None = None
    size_hectares: float | None = None
    suspected_cause: str | None = None


class IncidentUpdateItem(BaseModel):
    title: str
    published_at: str | None = None
    body: str
    is_current: bool = False


class IncidentRestrictionItem(BaseModel):
    restriction_type: str
    title: str
    status: str | None = None
    authority: str | None = None
    details: str | None = None


class IncidentMapAssetItem(BaseModel):
    asset_type: str
    title: str
    description: str | None = None
    asset_url: str | None = None
    is_download: bool = False


class IncidentEnvironmentContextItem(BaseModel):
    source_key: str
    title: str
    context_type: str
    summary: str | None = None
    payload: dict


class LinkedDiscourseSummary(BaseModel):
    discourse_item_id: int
    actor_name: str | None = None
    platform: str
    body_text: str | None = None
    posted_at: str | None = None
    link_reason: str | None = None


class IncidentDetail(BaseModel):
    fire_number: str
    wildfire_name: str
    stage_of_control: str
    size_hectares: float | None = None
    discovered_at: str | None = None
    updated_at: str | None = None
    fire_centre: str | None = None
    location_summary: str | None = None
    suspected_cause: str | None = None
    response_summary: str | None = None
    geometry_reference: dict | None = None
    perimeter_reference: dict | None = None
    resources_summary: dict | None = None
    gallery_summary: dict | None = None
    map_references: dict | None = None
    updates: list[IncidentUpdateItem]
    restrictions: list[IncidentRestrictionItem]
    map_assets: list[IncidentMapAssetItem]
    environment_context: list[IncidentEnvironmentContextItem]
    linked_discourse: list[LinkedDiscourseSummary]


class FireCentreOutlookSummary(BaseModel):
    fire_centre: str
    issued_on: str | None = None
    valid_window: str | None = None
    summary: str
    outlook: str | None = None


class EnvironmentOverview(BaseModel):
    outlooks: list[FireCentreOutlookSummary]
    latest_conditions: list[ConditionSummary]


class MapCatalogEntry(BaseModel):
    fire_number: str
    wildfire_name: str
    title: str
    asset_type: str
    asset_url: str | None = None
    is_download: bool = False
