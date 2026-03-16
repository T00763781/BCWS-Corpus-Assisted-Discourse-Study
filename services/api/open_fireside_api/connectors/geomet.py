from __future__ import annotations

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import ConditionSnapshot, ConnectorRun


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
            for item in snapshots:
                session.add(ConditionSnapshot(source_key=self.key, title=item["title"], region="British Columbia", condition_type=item["condition_type"], payload=item["payload"]))
            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded GeoMet baseline condition records", stats={"snapshots": len(snapshots)}))
        return ConnectorResult(status="success", message="GeoMet baseline seeded", stats={"snapshots": len(snapshots)})
