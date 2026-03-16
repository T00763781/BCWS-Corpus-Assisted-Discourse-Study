# Recon Summary

- source label: BC Wildfire Situation List
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/list
- what the page appears to provide: List route in the shared BCWS Angular shell. The route appears to depend on the published-incident family and related attachment or external-link families, while also sharing the public perimeter layer used elsewhere in the cluster.
- what was confirmed vs still unresolved:
  - Confirmed: The route shares the same Angular shell and bundle as dashboard and map. The public perimeter layer is concrete and queryable, and the bundle exposes published-incident, attachment, external-link, and situation-report client families.
  - Still unresolved: The `wfim` and `wfnews` hosts still do not resolve from this environment, so the incident-list payload, attachment payloads, and external URI payloads remain unresolved.
- shared BCWS shell observations:
  - Dashboard, map, and list routes all load the same `main.da9882e70a9138f1.js` Angular bundle.
  - The shared bundle contains NRS API client families plus ArcGIS layer wiring and popup templates.
  - `incidentSituation.stageOfControlCode` appears in the bundle model mapping, and the perimeter layer exposes `FIRE_STATUS` as the mapped public field.
- concrete endpoint families:
  - bcws_list_page: verified / shared=false / https://wildfiresituation.nrs.gov.bc.ca/list
  - bcws_shared_main_js: verified / shared=true / https://wildfiresituation.nrs.gov.bc.ca/main.da9882e70a9138f1.js
  - bcws_shared_published_incident_api: unresolved / shared=true / https://wfim.nrs.gov.bc.ca/v1/publishedIncident
  - bcws_list_attachment_api: unresolved / shared=false / https://wfim.nrs.gov.bc.ca/v1/attachment
  - bcws_list_external_uri_api: unresolved / shared=false / https://wfim.nrs.gov.bc.ca/v1/externalUri
  - bcws_shared_situation_report_api: unresolved / shared=true / https://wfnews.nrs.gov.bc.ca/v1/situationReport
  - bcws_fire_perimeters_layer: verified / shared=true / https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0
- concrete layer/service URLs:
  - Fire perimeters: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0 (count 320)
  - FSR safety information: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/FSR_Safety_Information_View/FeatureServer/0 (count 100)
  - Recreation closures: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/RecSitesReservesInterpForests_DetailsClosures_publicView/FeatureServer/0 (count 2272)
- auth/cors/anti-automation observations if relevant:
  - The three ArcGIS public services are directly queryable from this environment.
  - `wfim`, `wfnews`, `wfone`, and `resources.wfdm` hostnames remain unresolved from this environment, so those families stay probable or unresolved.
  - No concrete evacuation ArcGIS service was isolated in bounded recon; the bundle only exposed evacuation-related copy text.
- candidate widget ideas:
  - Incident list table: confidence=medium / status=candidate_only / Most natural first list candidate if the published-incident API becomes directly reachable.
  - Route-level incident detail input: confidence=low / status=candidate_only / Perimeter features expose `FIRE_URL`, but the route-level incident detail and external URI payload path remains unresolved.
  - Incident attachment links: confidence=low / status=candidate_only / Attachment client family is in the bundle, but no direct payload specimen was captured.
- confidence level: medium
- recommendation: pursue

## resolution checks
- wfim.nrs.gov.bc.ca: unresolved ([Errno 11001] getaddrinfo failed)
- wfnews.nrs.gov.bc.ca: unresolved ([Errno 11001] getaddrinfo failed)
- wfone.nrs.gov.bc.ca: unresolved ([Errno 11001] getaddrinfo failed)
- resources.wfdm.nrs.gov.bc.ca: unresolved ([Errno 11001] getaddrinfo failed)

## bundle snippet ids
- published_incident_client: captured
- published_incident_model: captured
- attachment_client: captured
- external_uri_client: captured
- situation_report_client: captured
- notification_client: captured
- notification_settings_client: captured
- file_metadata_client: captured
- file_details_client: captured
- geocoder_client: captured
- evacuation_copy_only: captured
- perimeter_popup_stage_of_control: captured
