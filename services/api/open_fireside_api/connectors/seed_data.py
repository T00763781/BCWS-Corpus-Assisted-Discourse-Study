from __future__ import annotations

BCWS_INCIDENTS = [
    {
        "fire_number": "G70422",
        "wildfire_name": "Kiskatinaw River",
        "stage_of_control": "Under Control",
        "size_hectares": 26195.3,
        "discovered_at": "2025-05-28T00:00:00-07:00",
        "last_updated_at": "2026-03-07T23:40:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Kiskatinaw River",
        "suspected_cause": "Lightning",
        "response_summary": (
            "BC Wildfire Service continues winter monitoring with thermal imaging, duff sampling, "
            "and patrol prioritization around the Kiskatinaw River wildfire perimeter."
        ),
        "geometry_reference": {"layer": "BCWS_FirePerimeters_PublicView", "feature": "G70422"},
        "perimeter_reference": {"source": "BCWS perimeter layer", "status": "tracked"},
        "resources_summary": {
            "personnel": None,
            "imt": None,
            "aviation": None,
            "heavy_equipment": None,
            "structure_protection": None,
        },
        "gallery_summary": {"items": 1, "note": "Thermal imaging and patrol media references expected."},
        "map_references": {"downloads": 0, "note": "No public map downloads currently attached in the source workflow."},
    },
    {
        "fire_number": "G90413",
        "wildfire_name": "Summit Lake",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-28T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "10km NE of Summit Lake",
        "suspected_cause": None,
        "response_summary": "Incident remains under control with perimeter and local authority context preserved in the workstation.",
    },
    {
        "fire_number": "G90711",
        "wildfire_name": "G90711",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-06-21T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Major Hart River",
        "suspected_cause": None,
        "response_summary": "BCWS incident record tracked for operational context.",
    },
    {
        "fire_number": "G90421",
        "wildfire_name": "G90421",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-28T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Terminus Mountain",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90463",
        "wildfire_name": "G90463",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-06-01T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Liard River",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90881",
        "wildfire_name": "G90881",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-07-08T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Junction of Dunedin and Liard Rivers",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90351",
        "wildfire_name": "G90351",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-19T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "28km Deer River Rd",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90220",
        "wildfire_name": "G90220",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-02T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "NW of Fort Nelson River",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90216",
        "wildfire_name": "G90216",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-02T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Etcho Creek",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90400",
        "wildfire_name": "G90400",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-27T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Kimea Creek",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
    {
        "fire_number": "G90382",
        "wildfire_name": "G90382",
        "stage_of_control": "Under Control",
        "size_hectares": None,
        "discovered_at": "2025-05-25T00:00:00-07:00",
        "last_updated_at": "2025-12-15T12:00:00-08:00",
        "fire_centre": "Prince George Fire Centre",
        "location_summary": "Shekilic River",
        "suspected_cause": None,
        "response_summary": "Incident retained for list and map context.",
    },
]

BCWS_INCIDENT_UPDATES = {
    "G70422": [
        {
            "title": "Response Update",
            "published_at": "2026-03-07T23:40:00-08:00",
            "is_current": True,
            "body": (
                "Fall operations used aircraft thermal imaging and predictive services organic layer sampling "
                "across the Fort Nelson region. Winter operations continue with remote sensing, patrol focus on "
                "high-risk perimeter segments, and suppression action if values become imminently threatened."
            ),
        },
        {
            "title": "Previous update",
            "published_at": "2025-12-15T12:00:00-08:00",
            "is_current": False,
            "body": (
                "Fuel sampling showed stronger organic moisture recovery than the prior two falls, reducing but not "
                "eliminating overwintering potential."
            ),
        },
    ],
}

BCWS_RESTRICTIONS = {
    "G70422": [
        {
            "restriction_type": "evacuation_alert",
            "title": "Local authority evacuation context",
            "status": "Monitor",
            "authority": "Northern Rockies Regional Municipality / First Nation authority",
            "details": (
                "BC Wildfire Service displays evacuation information when available. Operators should confirm the "
                "latest local authority status before actioning a field response."
            ),
        },
        {
            "restriction_type": "area_restriction",
            "title": "Kiskatinaw River area restriction candidate",
            "status": "Tracked from BCWS layer",
            "authority": "BC Wildfire Service",
            "details": "Derived from the BCWS area restriction endpoint family discovered in the connector catalog.",
        },
    ],
}

BCWS_MAP_ASSETS = {
    "G70422": [
        {
            "asset_type": "gallery",
            "title": "Thermal imaging reference",
            "description": "Thermal imaging and patrol evidence referenced in the latest winter monitoring update.",
            "asset_url": None,
            "is_download": False,
        },
        {
            "asset_type": "map",
            "title": "Public perimeter layer reference",
            "description": "BCWS public perimeter layer candidate for incident map composition.",
            "asset_url": None,
            "is_download": True,
        },
    ],
}

GEOMET_FIRE_CENTRE_OUTLOOKS = [
    {
        "fire_centre": "Coastal Fire Centre",
        "issued_on": "2026-03-08T07:00:00-08:00",
        "valid_window": "Tonight - Sunday Night",
        "summary": "Rain tonight, heavy at times along coastal sections. Clearing early Sunday with sunny conditions.",
        "outlook": "Northwest winds increase through late morning with a chance of evening showers Sunday night.",
    },
    {
        "fire_centre": "Southeast Fire Centre",
        "issued_on": "2026-03-08T07:00:00-08:00",
        "valid_window": "Tonight - Sunday Night",
        "summary": "Mainly cloudy conditions with scattered showers Sunday. Strong southwest winds develop through the day.",
        "outlook": "Temperatures fall Sunday afternoon with possible flurries overnight.",
    },
    {
        "fire_centre": "Kamloops Fire Centre",
        "issued_on": "2026-03-08T07:00:00-08:00",
        "valid_window": "Tonight - Sunday Night",
        "summary": "Cloudy with showers developing Sunday morning and a cooling trend as winds shift northwest.",
        "outlook": "Rain showers change to flurries Sunday night in parts of the region.",
    },
    {
        "fire_centre": "Prince George Fire Centre",
        "issued_on": "2026-03-08T07:00:00-08:00",
        "valid_window": "Tonight - Sunday Night",
        "summary": "Cloud cover lingers overnight with cooler temperatures and intermittent wind through the Fort Nelson corridor.",
        "outlook": "Expect changing smoke transport and localized overnight cooling that matters for patrol and thermal interpretation.",
    },
]
