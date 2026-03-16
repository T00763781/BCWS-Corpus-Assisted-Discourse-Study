import json
import os
import re
import socket
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(os.environ.get("OF_BCWS_SOURCE_ROOT", Path(__file__).resolve().parents[1]))
CONFIG_PATH = ROOT / "scripts" / "deepen_config.json"


SHARED_LAYERS = {
    "bcws_fire_perimeters_layer": {
        "base_url": "https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0",
        "metadata_name": "bcws_fire_perimeters_layer_metadata.json",
        "sample_name": "bcws_fire_perimeters_sample.json",
        "count_name": "bcws_fire_perimeters_count.json",
        "sample_params": {
            "where": "1=1",
            "outFields": "FIRE_NUMBER,FIRE_YEAR,FIRE_SIZE_HECTARES,FIRE_STATUS,TRACK_DATE,FIRE_URL",
            "resultRecordCount": 3,
            "returnGeometry": "false",
            "f": "pjson",
        },
    },
    "bcws_fsr_safety_layer": {
        "base_url": "https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/FSR_Safety_Information_View/FeatureServer/0",
        "metadata_name": "bcws_fsr_safety_layer_metadata.json",
        "sample_name": "bcws_fsr_safety_sample.json",
        "count_name": "bcws_fsr_safety_count.json",
        "sample_params": {
            "where": "1=1",
            "outFields": "ALERT_TYPE,LOCATION,INFORMATION,NOTICE,Contact",
            "resultRecordCount": 3,
            "returnGeometry": "false",
            "f": "pjson",
        },
    },
    "bcws_recreation_closures_layer": {
        "base_url": "https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/RecSitesReservesInterpForests_DetailsClosures_publicView/FeatureServer/0",
        "metadata_name": "bcws_recreation_closures_layer_metadata.json",
        "sample_name": "bcws_recreation_closures_sample.json",
        "count_name": "bcws_recreation_closures_count.json",
        "sample_params": {
            "where": "1=1",
            "outFields": "PROJECT_NAME,CLOSURE_IND,CLOSURE_DATE,CLOSURE_TYPE,SITE_LOCATION,ORG_UNIT_NAME",
            "resultRecordCount": 3,
            "returnGeometry": "false",
            "f": "pjson",
        },
    },
}


BUNDLE_SNIPPETS = {
    "published_incident_client": "createPublishedIncident",
    "published_incident_model": "incidentSituation.stageOfControlCode",
    "attachment_client": "/v1/attachment",
    "external_uri_client": "/v1/externalUri",
    "situation_report_client": "/v1/situationReport",
    "notification_client": "/v1/notification",
    "notification_settings_client": "/v1/notificationSettings",
    "file_metadata_client": "resources.wfdm.nrs.gov.bc.ca/fileMetadataResource",
    "file_details_client": "resources.wfdm.nrs.gov.bc.ca/fileDetails",
    "geocoder_client": "geocoder.api.gov.bc.ca/addresses.geojsonp",
    "evacuation_copy_only": "evacuations and local fire bans",
    "perimeter_popup_stage_of_control": "Fire Perimeter Number",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": "OpenFireside-BCWS-Recon/1.0"})
    with urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_json(url: str):
    return json.loads(fetch_text(url))


def fetch_arcgis_artifacts(specimen_dir: Path):
    artifacts = {}
    for endpoint_id, layer in SHARED_LAYERS.items():
        metadata_url = f"{layer['base_url']}?f=pjson"
        count_url = f"{layer['base_url']}/query?{urlencode({'where': '1=1', 'returnCountOnly': 'true', 'f': 'pjson'})}"
        sample_url = f"{layer['base_url']}/query?{urlencode(layer['sample_params'])}"

        metadata = fetch_json(metadata_url)
        count_data = fetch_json(count_url)
        sample_data = fetch_json(sample_url)

        save_json(specimen_dir / layer["metadata_name"], metadata)
        save_json(specimen_dir / layer["count_name"], count_data)
        save_json(specimen_dir / layer["sample_name"], sample_data)

        fields = [field["name"] for field in metadata.get("fields", [])]
        artifacts[endpoint_id] = {
            "metadata_url": metadata_url,
            "count_url": count_url,
            "sample_url": sample_url,
            "count": count_data.get("count"),
            "fields": fields,
        }
    return artifacts


def extract_snippets(bundle_text: str):
    snippets = {}
    for snippet_id, needle in BUNDLE_SNIPPETS.items():
        idx = bundle_text.find(needle)
        if idx == -1:
            snippets[snippet_id] = None
            continue
        start = max(0, idx - 220)
        end = min(len(bundle_text), idx + 280)
        snippets[snippet_id] = bundle_text[start:end]
    return snippets


def check_resolution(hostname: str):
    try:
        return {"hostname": hostname, "resolved": True, "address": socket.gethostbyname(hostname)}
    except OSError as exc:
        return {"hostname": hostname, "resolved": False, "error": str(exc)}


def write_summary(
    config,
    endpoints,
    widgets,
    layer_artifacts,
    snippets,
    resolution_checks,
    note_path: Path,
):
    verified = [e for e in endpoints if e["verification_status"] == "verified"]
    unresolved = [e for e in endpoints if e["verification_status"] != "verified"]

    lines = [
        "# Recon Summary",
        "",
        f"- source label: {config['source_label']}",
        f"- canonical URL: {config['canonical_url']}",
        f"- what the page appears to provide: {config['page_summary']}",
        "- what was confirmed vs still unresolved:",
        f"  - Confirmed: {config['confirmed_summary']}",
        f"  - Still unresolved: {config['unresolved_summary']}",
        "- shared BCWS shell observations:",
        "  - Dashboard, map, and list routes all load the same `main.da9882e70a9138f1.js` Angular bundle.",
        "  - The shared bundle contains NRS API client families plus ArcGIS layer wiring and popup templates.",
        "  - `incidentSituation.stageOfControlCode` appears in the bundle model mapping, and the perimeter layer exposes `FIRE_STATUS` as the mapped public field.",
        "- concrete endpoint families:",
    ]
    for endpoint in endpoints:
        lines.append(
            f"  - {endpoint['endpoint_id']}: {endpoint['verification_status']} / shared={str(endpoint['shared_across_sources']).lower()} / {endpoint['url']}"
        )
    lines.extend(
        [
            "- concrete layer/service URLs:",
            f"  - Fire perimeters: {SHARED_LAYERS['bcws_fire_perimeters_layer']['base_url']} (count {layer_artifacts['bcws_fire_perimeters_layer']['count']})",
            f"  - FSR safety information: {SHARED_LAYERS['bcws_fsr_safety_layer']['base_url']} (count {layer_artifacts['bcws_fsr_safety_layer']['count']})",
            f"  - Recreation closures: {SHARED_LAYERS['bcws_recreation_closures_layer']['base_url']} (count {layer_artifacts['bcws_recreation_closures_layer']['count']})",
            "- auth/cors/anti-automation observations if relevant:",
            "  - The three ArcGIS public services are directly queryable from this environment.",
            "  - `wfim`, `wfnews`, `wfone`, and `resources.wfdm` hostnames remain unresolved from this environment, so those families stay probable or unresolved.",
            "  - No concrete evacuation ArcGIS service was isolated in bounded recon; the bundle only exposed evacuation-related copy text.",
            "- candidate widget ideas:",
        ]
    )
    for widget in widgets:
        lines.append(
            f"  - {widget['label']}: confidence={widget['confidence']} / status={widget['status']} / {widget['notes']}"
        )
    lines.extend(
        [
            f"- confidence level: {config['confidence']}",
            f"- recommendation: {config['recommendation']}",
            "",
            "## resolution checks",
        ]
    )
    for item in resolution_checks:
        if item["resolved"]:
            lines.append(f"- {item['hostname']}: resolved to {item['address']}")
        else:
            lines.append(f"- {item['hostname']}: unresolved ({item['error']})")
    lines.extend(["", "## bundle snippet ids"])
    for snippet_id, snippet in snippets.items():
        state = "captured" if snippet else "not found"
        lines.append(f"- {snippet_id}: {state}")
    note_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    config = load_json(CONFIG_PATH)
    for subdir in ["specimens", "output", "notes"]:
        (ROOT / subdir).mkdir(parents=True, exist_ok=True)

    bundle_path = ROOT / "specimens" / "https_wildfiresituation_nrs_gov_bc_ca_main_da9882e70a9138f1_js.js"
    if not bundle_path.exists():
        bundle_path.write_text(fetch_text(config["bundle_url"]), encoding="utf-8")
    bundle_text = bundle_path.read_text(encoding="utf-8", errors="ignore")

    snippets = extract_snippets(bundle_text)
    save_json(ROOT / "specimens" / "bcws_bundle_snippets.json", snippets)

    layer_artifacts = fetch_arcgis_artifacts(ROOT / "specimens")

    resolution_checks = [
        check_resolution("wfim.nrs.gov.bc.ca"),
        check_resolution("wfnews.nrs.gov.bc.ca"),
        check_resolution("wfone.nrs.gov.bc.ca"),
        check_resolution("resources.wfdm.nrs.gov.bc.ca"),
    ]
    save_json(ROOT / "output" / "resolution_checks.json", resolution_checks)

    endpoints = config["endpoints"]
    widgets = config["widgets"]

    save_json(ROOT / "output" / "endpoints.json", endpoints)
    save_json(ROOT / "output" / "widget_candidates.json", widgets)
    save_json(
        ROOT / "output" / "run_summary.json",
        {
            "source_id": config["source_id"],
            "specimen_files": sorted(
                str(path.relative_to(ROOT)).replace("\\", "/")
                for path in (ROOT / "specimens").glob("*")
                if path.is_file()
            ),
            "endpoint_count": len(endpoints),
            "widget_candidate_count": len(widgets),
        },
    )

    write_summary(
        config,
        endpoints,
        widgets,
        layer_artifacts,
        snippets,
        resolution_checks,
        ROOT / "notes" / "recon_summary.md",
    )


if __name__ == "__main__":
    main()
