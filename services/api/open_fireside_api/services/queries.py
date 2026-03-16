from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import func, select

from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import (
    Actor,
    Claim,
    ConditionSnapshot,
    ConnectorRun,
    DiscourseItem,
    FireCentreOutlook,
    Incident,
    IncidentDiscourseLink,
    IncidentEnvironmentContext,
    IncidentMapAsset,
    IncidentRestriction,
    IncidentUpdate,
)


def _isoformat(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def analytics_snapshot() -> dict:
    with session_scope() as session:
        return {
            "connector_runs": session.scalar(select(func.count()).select_from(ConnectorRun)) or 0,
            "condition_snapshots": session.scalar(select(func.count()).select_from(ConditionSnapshot)) or 0,
            "incidents": session.scalar(select(func.count()).select_from(Incident)) or 0,
            "discourse_items": session.scalar(select(func.count()).select_from(DiscourseItem)) or 0,
            "actors": session.scalar(select(func.count()).select_from(Actor)) or 0,
            "claims": session.scalar(select(func.count()).select_from(Claim)) or 0,
        }


def latest_conditions(limit: int = 25) -> list[ConditionSnapshot]:
    with session_scope() as session:
        return list(session.scalars(select(ConditionSnapshot).order_by(ConditionSnapshot.created_at.desc()).limit(limit)))


def dashboard_overview() -> dict:
    with session_scope() as session:
        incidents = list(session.scalars(select(Incident).order_by(Incident.last_updated_at.desc().nullslast(), Incident.fire_number.asc())))
        restrictions = list(session.scalars(select(IncidentRestriction)))
        fire_centres = {}
        for incident in incidents:
            centre_key = incident.fire_centre or "Unassigned"
            summary = fire_centres.setdefault(centre_key, {"fire_centre": centre_key, "incident_count": 0, "out_of_control": 0, "being_held": 0, "under_control": 0})
            summary["incident_count"] += 1
            if incident.stage_of_control == "Out of Control":
                summary["out_of_control"] += 1
            elif incident.stage_of_control == "Being Held":
                summary["being_held"] += 1
            elif incident.stage_of_control == "Under Control":
                summary["under_control"] += 1

        pinned = [{
            "fire_number": incident.fire_number,
            "wildfire_name": incident.wildfire_name,
            "stage_of_control": incident.stage_of_control,
            "fire_centre": incident.fire_centre,
            "size_hectares": incident.size_hectares,
            "updated_at": _isoformat(incident.last_updated_at),
        } for incident in incidents[:5]]

        return {
            "active_incidents": len(incidents),
            "out_of_control": sum(1 for incident in incidents if incident.stage_of_control == "Out of Control"),
            "being_held": sum(1 for incident in incidents if incident.stage_of_control == "Being Held"),
            "under_control": sum(1 for incident in incidents if incident.stage_of_control == "Under Control"),
            "evacuation_orders": sum(1 for restriction in restrictions if restriction.restriction_type == "evacuation_order"),
            "evacuation_alerts": sum(1 for restriction in restrictions if restriction.restriction_type == "evacuation_alert"),
            "area_restrictions": sum(1 for restriction in restrictions if restriction.restriction_type == "area_restriction"),
            "fire_centres": sorted(fire_centres.values(), key=lambda item: item["fire_centre"]),
            "pinned_incidents": pinned,
        }


def list_incidents() -> list[dict]:
    with session_scope() as session:
        incidents = list(session.scalars(select(Incident).order_by(Incident.last_updated_at.desc().nullslast(), Incident.wildfire_name.asc())))
        return [{
            "fire_number": incident.fire_number,
            "wildfire_name": incident.wildfire_name,
            "stage_of_control": incident.stage_of_control,
            "fire_centre": incident.fire_centre,
            "location_summary": incident.location_summary,
            "discovered_at": _isoformat(incident.discovered_at),
            "updated_at": _isoformat(incident.last_updated_at),
            "size_hectares": incident.size_hectares,
            "suspected_cause": incident.suspected_cause,
        } for incident in incidents]


def incident_detail(fire_number: str) -> dict | None:
    with session_scope() as session:
        incident = session.scalar(select(Incident).where(Incident.fire_number == fire_number))
        if incident is None:
            return None

        updates = list(session.scalars(select(IncidentUpdate).where(IncidentUpdate.incident_id == incident.id).order_by(IncidentUpdate.published_at.desc().nullslast(), IncidentUpdate.created_at.desc())))
        restrictions = list(session.scalars(select(IncidentRestriction).where(IncidentRestriction.incident_id == incident.id).order_by(IncidentRestriction.created_at.desc())))
        map_assets = list(session.scalars(select(IncidentMapAsset).where(IncidentMapAsset.incident_id == incident.id).order_by(IncidentMapAsset.asset_type.asc(), IncidentMapAsset.title.asc())))
        environment_context = list(session.scalars(select(IncidentEnvironmentContext).where(IncidentEnvironmentContext.incident_id == incident.id).order_by(IncidentEnvironmentContext.context_type.asc(), IncidentEnvironmentContext.title.asc())))
        linked_discourse_rows = list(session.execute(
            select(IncidentDiscourseLink, DiscourseItem)
            .join(DiscourseItem, IncidentDiscourseLink.discourse_item_id == DiscourseItem.id)
            .where(IncidentDiscourseLink.incident_id == incident.id)
            .order_by(IncidentDiscourseLink.created_at.desc())
        ))

        return {
            "fire_number": incident.fire_number,
            "wildfire_name": incident.wildfire_name,
            "stage_of_control": incident.stage_of_control,
            "size_hectares": incident.size_hectares,
            "discovered_at": _isoformat(incident.discovered_at),
            "updated_at": _isoformat(incident.last_updated_at),
            "fire_centre": incident.fire_centre,
            "location_summary": incident.location_summary,
            "suspected_cause": incident.suspected_cause,
            "response_summary": incident.response_summary,
            "geometry_reference": incident.geometry_reference,
            "perimeter_reference": incident.perimeter_reference,
            "resources_summary": incident.resources_summary,
            "gallery_summary": incident.gallery_summary,
            "map_references": incident.map_references,
            "updates": [{
                "title": update.title,
                "published_at": _isoformat(update.published_at),
                "body": update.body,
                "is_current": update.is_current,
            } for update in updates],
            "restrictions": [{
                "restriction_type": restriction.restriction_type,
                "title": restriction.title,
                "status": restriction.status,
                "authority": restriction.authority,
                "details": restriction.details,
            } for restriction in restrictions],
            "map_assets": [{
                "asset_type": asset.asset_type,
                "title": asset.title,
                "description": asset.description,
                "asset_url": asset.asset_url,
                "is_download": asset.is_download,
            } for asset in map_assets],
            "environment_context": [{
                "source_key": context.source_key,
                "title": context.title,
                "context_type": context.context_type,
                "summary": context.summary,
                "payload": context.payload,
            } for context in environment_context],
            "linked_discourse": [{
                "discourse_item_id": discourse_item.id,
                "actor_name": discourse_item.actor_name,
                "platform": discourse_item.platform,
                "body_text": discourse_item.body_text,
                "posted_at": discourse_item.posted_at,
                "link_reason": link.link_reason,
            } for link, discourse_item in linked_discourse_rows],
        }


def environment_overview() -> dict:
    with session_scope() as session:
        outlooks = list(session.scalars(select(FireCentreOutlook).order_by(FireCentreOutlook.fire_centre.asc(), FireCentreOutlook.issued_on.desc().nullslast())))
        latest = list(session.scalars(select(ConditionSnapshot).order_by(ConditionSnapshot.created_at.desc()).limit(40)))
        return {
            "outlooks": [{
                "fire_centre": outlook.fire_centre,
                "issued_on": _isoformat(outlook.issued_on),
                "valid_window": outlook.valid_window,
                "summary": outlook.summary,
                "outlook": outlook.outlook,
            } for outlook in outlooks],
            "latest_conditions": [{
                "source_key": condition.source_key,
                "title": condition.title,
                "condition_type": condition.condition_type,
                "region": condition.region,
                "payload": condition.payload,
            } for condition in latest],
        }


def map_catalog() -> list[dict]:
    with session_scope() as session:
        rows = list(session.execute(
            select(Incident, IncidentMapAsset)
            .join(IncidentMapAsset, Incident.id == IncidentMapAsset.incident_id)
            .order_by(Incident.wildfire_name.asc(), IncidentMapAsset.asset_type.asc())
        ))
        return [{
            "fire_number": incident.fire_number,
            "wildfire_name": incident.wildfire_name,
            "title": asset.title,
            "asset_type": asset.asset_type,
            "asset_url": asset.asset_url,
            "is_download": asset.is_download,
        } for incident, asset in rows]
