from open_fireside_api.services.registry import CONNECTORS


def test_registry_contains_expected_connectors():
    assert {"bcws.catalog", "cwfis.summary", "geomet.weather", "social.seed"}.issubset(CONNECTORS.keys())
