from __future__ import annotations

from open_fireside_api.connectors.bcws import BCWSCatalogConnector
from open_fireside_api.connectors.cwfis import CWFISConnector
from open_fireside_api.connectors.geomet import GeoMetConnector
from open_fireside_api.connectors.social import SocialSeedConnector

CONNECTORS = {
    BCWSCatalogConnector.key: BCWSCatalogConnector(),
    CWFISConnector.key: CWFISConnector(),
    GeoMetConnector.key: GeoMetConnector(),
    SocialSeedConnector.key: SocialSeedConnector(),
}
