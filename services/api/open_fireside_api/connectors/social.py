from __future__ import annotations

from open_fireside_api.connectors.base import ConnectorResult
from open_fireside_api.database import session_scope
from open_fireside_api.models.entities import Actor, Claim, ConnectorRun, DiscourseItem


class SocialSeedConnector:
    key = "social.seed"
    kind = "social"
    description = "Seed representative discourse records to validate workstation flows before live connectors are wired"

    def run(self) -> ConnectorResult:
        seed_items = [
            {
                "actor": "BC Wildfire Service",
                "platform": "bluesky",
                "text": "Operational update on wildfire conditions and area restrictions.",
                "claim": "Official wildfire status update",
                "claim_type": "operational_update",
            },
            {
                "actor": "Interior Local Watch",
                "platform": "telegram",
                "text": "People are asking whether smoke is shifting overnight and if alerts will widen.",
                "claim": "Public uncertainty around smoke shift and alerts",
                "claim_type": "information_gap",
            },
            {
                "actor": "Regional Conspiracy Relay",
                "platform": "x",
                "text": "A screenshot-based rumor claims officials are hiding perimeter growth.",
                "claim": "Officials hiding perimeter growth",
                "claim_type": "rumor_candidate",
            },
        ]
        with session_scope() as session:
            for item in seed_items:
                session.add(Actor(display_name=item["actor"], actor_type="seed_actor", platform=item["platform"], profile_url=None, metadata_json={"seeded": True}))
                session.add(Claim(canonical_text=item["claim"], claim_type=item["claim_type"], topic="wildfire", metadata_json={"seeded": True}))
                session.add(DiscourseItem(source_key=self.key, external_id=None, actor_name=item["actor"], platform=item["platform"], body_text=item["text"], posted_at=None, metadata_json={"seeded": True}))
            session.add(ConnectorRun(connector_key=self.key, status="success", message="Seeded discourse validation records", stats={"items": len(seed_items)}))
        return ConnectorResult(status="success", message="Social validation data seeded", stats={"items": len(seed_items)})
