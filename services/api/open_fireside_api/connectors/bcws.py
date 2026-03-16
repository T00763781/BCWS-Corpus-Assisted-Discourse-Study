from __future__ import annotations

import csv
from pathlib import Path

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import ConditionSnapshot, ConnectorRun, EndpointCatalogEntry
from open_fireside_config.settings import get_settings


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

            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded BCWS endpoint catalog", stats={"seeded": seeded, "candidates": len(likely_operational)}))

        return ConnectorResult(status="success", message="BCWS endpoint catalog seeded", stats={"seeded": seeded, "candidates": len(likely_operational)})
