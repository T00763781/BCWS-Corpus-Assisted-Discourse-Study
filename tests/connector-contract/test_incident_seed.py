from open_fireside_api.services.registry import CONNECTORS
from open_fireside_api.services.queries import dashboard_overview, incident_detail, list_incidents


def test_bcws_connector_populates_incident_spine():
    CONNECTORS["bcws.catalog"].run()
    CONNECTORS["cwfis.summary"].run()
    CONNECTORS["geomet.weather"].run()
    CONNECTORS["social.seed"].run()

    incidents = list_incidents()
    assert incidents
    assert any(incident["fire_number"] == "G70422" for incident in incidents)

    detail = incident_detail("G70422")
    assert detail is not None
    assert detail["wildfire_name"] == "Kiskatinaw River"
    assert detail["updates"]
    assert detail["environment_context"]

    overview = dashboard_overview()
    assert overview["active_incidents"] >= 1
