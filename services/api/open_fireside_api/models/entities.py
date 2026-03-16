from __future__ import annotations

from datetime import datetime
from sqlalchemy import JSON, DateTime, Integer, String, Text, func
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
