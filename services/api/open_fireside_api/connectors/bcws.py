from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, select

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.connectors.seed_data import BCWS_INCIDENTS, BCWS_INCIDENT_UPDATES, BCWS_MAP_ASSETS, BCWS_RESTRICTIONS
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import (
    ConditionSnapshot,
    ConnectorRun,
    EndpointCatalogEntry,
    Incident,
    IncidentEnvironmentContext,
    IncidentMapAsset,
    IncidentRestriction,
    IncidentUpdate,
)
from open_fireside_config.settings import get_settings


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


class BCWSCatalogConnector:
    key = "bcws.catalog"
    kind = "environment"
    description = "Seed BCWS endpoint reconnaissance catalog and derive likely operational endpoints"

    def run(self) -> ConnectorResult:
        settings = get_settings()
        catalog_path = Path(settings.endpoint_catalog)
        if not catalog_path.exists():
            return ConnectorResult(status="error", message=f"Catalog not found: {catalog_path}")

        seeded = 0
        likely_operational = []
        with session_scope() as session:
            existing_incidents = list(session.scalars(select(Incident).where(Incident.source_key == self.key)))
            existing_ids = [incident.id for incident in existing_incidents]
            if existing_ids:
                session.execute(delete(IncidentEnvironmentContext).where(IncidentEnvironmentContext.incident_id.in_(existing_ids)))
                session.execute(delete(IncidentMapAsset).where(IncidentMapAsset.incident_id.in_(existing_ids)))
                session.execute(delete(IncidentRestriction).where(IncidentRestriction.incident_id.in_(existing_ids)))
                session.execute(delete(IncidentUpdate).where(IncidentUpdate.incident_id.in_(existing_ids)))
            session.execute(delete(Incident).where(Incident.source_key == self.key))
            session.execute(delete(ConditionSnapshot).where(ConditionSnapshot.source_key == self.key))
            session.execute(delete(EndpointCatalogEntry).where(EndpointCatalogEntry.host == "services6.prod.bcwildfireservices.com"))

            with catalog_path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    session.add(
                        EndpointCatalogEntry(
                            url=row.get("url", ""),
                            host=row.get("host", ""),
                            path=row.get("path", ""),
                            endpoint_type=row.get("endpoint_type"),
                            endpoint_family=row.get("endpoint_family"),
                            source_category=row.get("source_category"),
                            occurrences=int(row.get("occurrences") or 0),
                            found_in=row.get("found_in"),
                        )
                    )
                    seeded += 1
                    path = row.get("path", "")
                    if any(token in path.lower() for token in ["incident", "featureserver", "statistics", "restriction", "evacuation"]):
                        likely_operational.append({
                            "title": row.get("endpoint_family") or path,
                            "condition_type": "endpoint_candidate",
                            "payload": row,
                        })

            for candidate in likely_operational[:50]:
                session.add(
                    ConditionSnapshot(
                        source_key=self.key,
                        title=candidate["title"],
                        region="British Columbia",
                        condition_type=candidate["condition_type"],
                        payload=candidate["payload"],
                    )
                )

            incident_records = {}
            for incident_seed in BCWS_INCIDENTS:
                incident = Incident(
                    source_key=self.key,
                    fire_number=incident_seed["fire_number"],
                    wildfire_name=incident_seed["wildfire_name"],
                    stage_of_control=incident_seed["stage_of_control"],
                    size_hectares=incident_seed.get("size_hectares"),
                    discovered_at=_parse_dt(incident_seed.get("discovered_at")),
                    last_updated_at=_parse_dt(incident_seed.get("last_updated_at")),
                    fire_centre=incident_seed.get("fire_centre"),
                    location_summary=incident_seed.get("location_summary"),
                    suspected_cause=incident_seed.get("suspected_cause"),
                    response_summary=incident_seed.get("response_summary"),
                    geometry_reference=incident_seed.get("geometry_reference"),
                    perimeter_reference=incident_seed.get("perimeter_reference"),
                    resources_summary=incident_seed.get("resources_summary"),
                    gallery_summary=incident_seed.get("gallery_summary"),
                    map_references=incident_seed.get("map_references"),
                    metadata_json={"mockup_aligned": True},
                )
                session.add(incident)
                session.flush()
                incident_records[incident.fire_number] = incident
                session.add(
                    IncidentEnvironmentContext(
                        incident_id=incident.id,
                        source_key=self.key,
                        title="BCWS perimeter reference",
                        context_type="perimeter",
                        summary="BCWS public perimeter layer is attached as the primary incident geometry reference.",
                        payload=incident_seed.get("perimeter_reference") or {"status": "tracked"},
                    )
                )

            for fire_number, updates in BCWS_INCIDENT_UPDATES.items():
                incident = incident_records.get(fire_number)
                if incident is None:
                    continue
                for update in updates:
                    session.add(
                        IncidentUpdate(
                            incident_id=incident.id,
                            source_key=self.key,
                            title=update["title"],
                            published_at=_parse_dt(update.get("published_at")),
                            body=update["body"],
                            is_current=update.get("is_current", False),
                            metadata_json={"mockup_aligned": True},
                        )
                    )

            for fire_number, restrictions in BCWS_RESTRICTIONS.items():
                incident = incident_records.get(fire_number)
                if incident is None:
                    continue
                for restriction in restrictions:
                    session.add(
                        IncidentRestriction(
                            incident_id=incident.id,
                            source_key=self.key,
                            restriction_type=restriction["restriction_type"],
                            title=restriction["title"],
                            status=restriction.get("status"),
                            authority=restriction.get("authority"),
                            details=restriction.get("details"),
                            external_reference=None,
                            metadata_json={"mockup_aligned": True},
                        )
                    )

            for fire_number, assets in BCWS_MAP_ASSETS.items():
                incident = incident_records.get(fire_number)
                if incident is None:
                    continue
                for asset in assets:
                    session.add(
                        IncidentMapAsset(
                            incident_id=incident.id,
                            source_key=self.key,
                            asset_type=asset["asset_type"],
                            title=asset["title"],
                            description=asset.get("description"),
                            asset_url=asset.get("asset_url"),
                            is_download=asset.get("is_download", False),
                            metadata_json={"mockup_aligned": True},
                        )
                    )

            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded BCWS endpoint catalog", stats={"seeded": seeded, "candidates": len(likely_operational)}))

        return ConnectorResult(
            status="success",
            message="BCWS endpoint catalog and incident spine seeded",
            stats={"seeded": seeded, "candidates": len(likely_operational), "incidents": len(incident_records)},
        )
