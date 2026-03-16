from __future__ import annotations

from sqlalchemy import delete, select

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import ConditionSnapshot, ConnectorRun, Incident, IncidentEnvironmentContext


class CWFISConnector:
    key = "cwfis.summary"
    kind = "environment"
    description = "Seed placeholder CWFIS condition records for local-first development"

    def run(self) -> ConnectorResult:
        snapshots = [
            {"title": "CWFIS Fire Danger Layer", "condition_type": "fire_danger", "payload": {"status": "configured", "notes": "Datamart ingestion adapter pending live credentials/polling"}},
            {"title": "CWFIS Hotspots Layer", "condition_type": "hotspots", "payload": {"status": "configured", "notes": "Connector contract and parser scaffolded"}},
        ]
        with session_scope() as session:
            session.execute(delete(ConditionSnapshot).where(ConditionSnapshot.source_key == self.key))
            session.execute(delete(IncidentEnvironmentContext).where(IncidentEnvironmentContext.source_key == self.key))
            for item in snapshots:
                session.add(ConditionSnapshot(source_key=self.key, title=item["title"], region="Canada", condition_type=item["condition_type"], payload=item["payload"]))
            incidents = list(session.scalars(select(Incident).order_by(Incident.last_updated_at.desc().nullslast(), Incident.fire_number.asc()).limit(3)))
            for incident in incidents:
                session.add(
                    IncidentEnvironmentContext(
                        incident_id=incident.id,
                        source_key=self.key,
                        title="CWFIS fire danger context",
                        context_type="fire_danger",
                        summary="National fire danger and hotspot layers retained as incident-adjacent environment context.",
                        payload={"layers": ["fire_danger", "hotspots"], "fire_centre": incident.fire_centre},
                    )
                )
            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded CWFIS baseline condition records", stats={"snapshots": len(snapshots)}))
        return ConnectorResult(status="success", message="CWFIS baseline seeded", stats={"snapshots": len(snapshots)})
