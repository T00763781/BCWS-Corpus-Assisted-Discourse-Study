from __future__ import annotations

from datetime import datetime
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from open_fireside_api.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EndpointCatalogEntry(TimestampMixin, Base):
    __tablename__ = "endpoint_catalog_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(Text)
    host: Mapped[str] = mapped_column(String(255), index=True)
    path: Mapped[str] = mapped_column(Text)
    endpoint_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    endpoint_family: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    occurrences: Mapped[int | None] = mapped_column(Integer, nullable=True)
    found_in: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConnectorRun(TimestampMixin, Base):
    __tablename__ = "connector_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    connector_key: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ConditionSnapshot(TimestampMixin, Base):
    __tablename__ = "condition_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    condition_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class Incident(TimestampMixin, Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True, default="bcws.catalog")
    fire_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    wildfire_name: Mapped[str] = mapped_column(String(255), index=True)
    stage_of_control: Mapped[str] = mapped_column(String(64), index=True)
    size_hectares: Mapped[float | None] = mapped_column(Float, nullable=True)
    discovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fire_centre: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    location_summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    suspected_cause: Mapped[str | None] = mapped_column(String(255), nullable=True)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry_reference: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    perimeter_reference: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resources_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    gallery_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    map_references: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IncidentUpdate(TimestampMixin, Base):
    __tablename__ = "incident_updates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True, default="bcws.catalog")
    title: Mapped[str] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IncidentRestriction(TimestampMixin, Base):
    __tablename__ = "incident_restrictions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True, default="bcws.catalog")
    restriction_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authority: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IncidentMapAsset(TimestampMixin, Base):
    __tablename__ = "incident_map_assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True, default="bcws.catalog")
    asset_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    asset_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_download: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IncidentEnvironmentContext(TimestampMixin, Base):
    __tablename__ = "incident_environment_contexts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(255))
    context_type: Mapped[str] = mapped_column(String(64), index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)


class IncidentDiscourseLink(TimestampMixin, Base):
    __tablename__ = "incident_discourse_links"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    discourse_item_id: Mapped[int] = mapped_column(ForeignKey("discourse_items.id"), index=True)
    link_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class FireCentreOutlook(TimestampMixin, Base):
    __tablename__ = "fire_centre_outlooks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True)
    fire_centre: Mapped[str] = mapped_column(String(255), index=True)
    issued_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_window: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    outlook: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Actor(TimestampMixin, Base):
    __tablename__ = "actors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), index=True)
    actor_type: Mapped[str] = mapped_column(String(100), index=True)
    platform: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Claim(TimestampMixin, Base):
    __tablename__ = "claims"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    canonical_text: Mapped[str] = mapped_column(Text)
    claim_type: Mapped[str] = mapped_column(String(100), index=True)
    topic: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class DiscourseItem(TimestampMixin, Base):
    __tablename__ = "discourse_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[str] = mapped_column(String(100), index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    platform: Mapped[str] = mapped_column(String(100), index=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
