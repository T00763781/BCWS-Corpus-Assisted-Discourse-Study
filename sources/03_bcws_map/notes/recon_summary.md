# Recon Summary

- source label: BC Wildfire Situation Map
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/map
- what the page appears to provide: Map route in the shared BCWS Angular shell. The route appears to depend on shared wildfire incident structures plus directly reachable public ArcGIS overlay layers.
- what was confirmed vs still unresolved:
  - Confirmed: The route shares the same Angular shell and bundle as dashboard and list. Public perimeter, forest-service-road safety, and recreation-closure layers are concrete and queryable. The shared bundle also exposes BC geocoder usage.
  - Still unresolved: No concrete evacuation service was isolated. The NRS incident and notification hosts remain unresolved from this environment, so those data families remain probable or unresolved.
- shared BCWS shell observations:
  - Dashboard, map, and list routes all load the same `main.da9882e70a9138f1.js` Angular bundle.
  - The shared bundle contains NRS API client families plus ArcGIS layer wiring and popup templates.
  - `incidentSituation.stageOfControlCode` appears in the bundle model mapping, and the perimeter layer exposes `FIRE_STATUS` as the mapped public field.
- concrete endpoint families:
  - bcws_map_page: verified / shared=false / https://wildfiresituation.nrs.gov.bc.ca/map
  - bcws_shared_main_js: verified / shared=true / https://wildfiresituation.nrs.gov.bc.ca/main.da9882e70a9138f1.js
  - bcws_shared_published_incident_api: unresolved / shared=true / https://wfim.nrs.gov.bc.ca/v1/publishedIncident
  - bcws_shared_notification_api: unresolved / shared=true / https://wfone.nrs.gov.bc.ca/v1/notification
  - bcws_map_geocoder_family: probable / shared=false / https://geocoder.api.gov.bc.ca/addresses.geojsonp
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
  - Perimeter map layer: confidence=high / status=candidate_only / Directly queryable public polygon layer with `FIRE_STATUS`, size, year, and detail URL fields.
  - Road-safety overlay: confidence=high / status=candidate_only / Verified public point layer with `CLOSURE`, `WARNING`, and `SEASONAL` domain values.
  - Recreation closures overlay: confidence=high / status=candidate_only / Verified public point layer with closure indicators, closure dates, and site metadata.
  - Evacuation overlay: confidence=low / status=candidate_only / No concrete evacuation layer URL was isolated in bounded recon; keep candidate-only until a real service is found.
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
