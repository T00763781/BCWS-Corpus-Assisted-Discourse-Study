from __future__ import annotations

from sqlalchemy import func, select

from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import Actor, Claim, ConditionSnapshot, ConnectorRun, DiscourseItem


def analytics_snapshot() -> dict:
    with session_scope() as session:
        return {
            "connector_runs": session.scalar(select(func.count()).select_from(ConnectorRun)) or 0,
            "condition_snapshots": session.scalar(select(func.count()).select_from(ConditionSnapshot)) or 0,
            "discourse_items": session.scalar(select(func.count()).select_from(DiscourseItem)) or 0,
            "actors": session.scalar(select(func.count()).select_from(Actor)) or 0,
            "claims": session.scalar(select(func.count()).select_from(Claim)) or 0,
        }


def latest_conditions(limit: int = 25) -> list[ConditionSnapshot]:
    with session_scope() as session:
        return list(session.scalars(select(ConditionSnapshot).order_by(ConditionSnapshot.created_at.desc()).limit(limit)))
