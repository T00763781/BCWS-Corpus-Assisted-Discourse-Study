# Recon Summary

- source label: BC Wildfire Situation Dashboard
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/dashboard
- what the page appears to provide: Dashboard route in the shared BCWS Angular shell. The route appears to summarize wildfire incidents and related supporting overlays, but concrete dashboard metrics still trace back to unresolved NRS APIs plus verified public ArcGIS layers.
- what was confirmed vs still unresolved:
  - Confirmed: The route shares the same Angular shell as map and list. The public perimeter, road-safety, and recreation-closure ArcGIS services are concrete and queryable. The bundle exposes stage-of-control structures and NRS client families.
  - Still unresolved: The `wfim`, `wfnews`, `wfone`, and `resources.wfdm` hostnames still do not resolve from this environment, so direct incident, notification, attachment, and situation-report payloads remain unverified.
- shared BCWS shell observations:
  - Dashboard, map, and list routes all load the same `main.da9882e70a9138f1.js` Angular bundle.
  - The shared bundle contains NRS API client families plus ArcGIS layer wiring and popup templates.
  - `incidentSituation.stageOfControlCode` appears in the bundle model mapping, and the perimeter layer exposes `FIRE_STATUS` as the mapped public field.
- concrete endpoint families:
  - bcws_dashboard_page: verified / shared=false / https://wildfiresituation.nrs.gov.bc.ca/dashboard
  - bcws_shared_main_js: verified / shared=true / https://wildfiresituation.nrs.gov.bc.ca/main.da9882e70a9138f1.js
  - bcws_shared_published_incident_api: unresolved / shared=true / https://wfim.nrs.gov.bc.ca/v1/publishedIncident
  - bcws_shared_situation_report_api: unresolved / shared=true / https://wfnews.nrs.gov.bc.ca/v1/situationReport
  - bcws_shared_notification_api: unresolved / shared=true / https://wfone.nrs.gov.bc.ca/v1/notification
  - bcws_shared_file_details_api: unresolved / shared=true / https://resources.wfdm.nrs.gov.bc.ca/fileDetails
  - bcws_fire_perimeters_layer: verified / shared=true / https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0
  - bcws_fsr_safety_layer: verified / shared=true / https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/FSR_Safety_Information_View/FeatureServer/0
  - bcws_recreation_closures_layer: verified / shared=true / https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/RecSitesReservesInterpForests_DetailsClosures_publicView/FeatureServer/0
- concrete layer/service URLs:
  - Fire perimeters: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0 (count 320)
  - FSR safety information: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/FSR_Safety_Information_View/FeatureServer/0 (count 100)
  - Recreation closures: https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/RecSitesReservesInterpForests_DetailsClosures_publicView/FeatureServer/0 (count 2272)
- auth/cors/anti-automation observations if relevant:
  - The three ArcGIS public services are directly queryable from this environment.
  - `wfim`, `wfnews`, `wfone`, and `resources.wfdm` hostnames remain unresolved from this environment, so those families stay probable or unresolved.
  - No concrete evacuation ArcGIS service was isolated in bounded recon; the bundle only exposed evacuation-related copy text.
- candidate widget ideas:
  - Incident totals: confidence=medium / status=candidate_only / Strong dashboard candidate if the published-incident API resolves in a later pass.
  - Stage-of-control counts: confidence=medium / status=candidate_only / Bundle exposes `incidentSituation.stageOfControlCode`, and the perimeter layer exposes `FIRE_STATUS`, but the incident API payload remains unresolved.
  - Situation report summary: confidence=low / status=candidate_only / Client family is present, but no direct payload specimen was obtained in this environment.
  - Perimeter-backed incident count: confidence=high / status=candidate_only / Public perimeter layer is directly queryable and already exposes countable records plus stage-like `FIRE_STATUS` values.
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
