from fastapi.testclient import TestClient

from open_fireside_api.main import app


client = TestClient(app)


def test_root_redirects_to_docs():
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/docs"


def test_api_routes_are_mounted_under_api_prefix():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_incident_routes_exist():
    response = client.get("/api/incidents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_dashboard_route_exists():
    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    assert "active_incidents" in response.json()


def test_legacy_routes_redirect_to_api_namespace():
    response = client.get("/connectors", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/api/connectors"


def test_conditions_endpoint_returns_payload():
    response = client.get("/api/conditions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
