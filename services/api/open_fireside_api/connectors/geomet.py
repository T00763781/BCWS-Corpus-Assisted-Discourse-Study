from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.connectors.seed_data import GEOMET_FIRE_CENTRE_OUTLOOKS
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import ConditionSnapshot, ConnectorRun, FireCentreOutlook, Incident, IncidentEnvironmentContext


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


class GeoMetConnector:
    key = "geomet.weather"
    kind = "environment"
    description = "Seed weather and forecast contract records for GeoMet-backed ingestion"

    def run(self) -> ConnectorResult:
        snapshots = [
            {"title": "Weather Station Overlay", "condition_type": "weather_station", "payload": {"status": "configured", "notes": "GeoMet source adapter scaffolded"}},
            {"title": "Forecast Shift Monitor", "condition_type": "forecast", "payload": {"status": "configured", "notes": "Designed for smoke and wind relevance"}},
        ]
        with session_scope() as session:
            session.execute(delete(ConditionSnapshot).where(ConditionSnapshot.source_key == self.key))
            session.execute(delete(IncidentEnvironmentContext).where(IncidentEnvironmentContext.source_key == self.key))
            session.execute(delete(FireCentreOutlook).where(FireCentreOutlook.source_key == self.key))
            for item in snapshots:
                session.add(ConditionSnapshot(source_key=self.key, title=item["title"], region="British Columbia", condition_type=item["condition_type"], payload=item["payload"]))
            for outlook in GEOMET_FIRE_CENTRE_OUTLOOKS:
                session.add(
                    FireCentreOutlook(
                        source_key=self.key,
                        fire_centre=outlook["fire_centre"],
                        issued_on=_parse_dt(outlook.get("issued_on")),
                        valid_window=outlook.get("valid_window"),
                        summary=outlook["summary"],
                        outlook=outlook.get("outlook"),
                        metadata_json={"mockup_aligned": True},
                    )
                )
            incidents = list(session.scalars(select(Incident).order_by(Incident.last_updated_at.desc().nullslast(), Incident.fire_number.asc()).limit(3)))
            for incident in incidents:
                session.add(
                    IncidentEnvironmentContext(
                        incident_id=incident.id,
                        source_key=self.key,
                        title="GeoMet weather overlay",
                        context_type="weather",
                        summary="Weather station and forecast-shift overlays retained as incident-level environment context.",
                        payload={"layers": ["weather_station", "forecast"], "fire_centre": incident.fire_centre},
                    )
                )
            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded GeoMet baseline condition records", stats={"snapshots": len(snapshots)}))
        return ConnectorResult(status="success", message="GeoMet baseline seeded", stats={"snapshots": len(snapshots)})
