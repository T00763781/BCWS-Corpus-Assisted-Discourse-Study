# Recon Summary

- source label: BC Wildfire Situation Map
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/map
- what the page appears to provide: Map-first route inside the same BC Wildfire Service Angular shell used by dashboard and list.
- likely data-bearing endpoint families:
  - Same NRS API families as the dashboard route: published incidents, notifications, situation reports, attachments, and file metadata.
  - Same public ArcGIS service families for fire perimeters, forest service road safety, and recreation closures.
  - Bundle references BC geocoder and ArcGIS basemap families for map interaction.
- likely map/layer families:
  - Fire perimeter feature layer.
  - Forest service road safety feature layer.
  - Recreation site closure feature layer.
  - ArcGIS basemap and vector tile families.
- specimen status: 5 saved
- auth/cors/anti-automation observations if relevant: Public shell. ArcGIS layers are accessible. Bundle-level NRS API families remain unresolved by DNS from this environment.
- widget candidate ideas:
  - Perimeter layer: Public ArcGIS perimeter layer metadata is accessible.
  - Road safety overlay: Public ArcGIS layer metadata is accessible.
  - Recreation closures overlay: Public ArcGIS layer metadata is accessible.
  - Notification overlay entry: Notification family is visible in the bundle but unresolved from this environment.
- confidence level: medium
- recommendation: pursue

## specimen files
- specimens\https_wildfiresituation_nrs_gov_bc_ca_map.html
- specimens\https_wildfiresituation_nrs_gov_bc_ca_main_da9882e70a9138f1_js.js
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_BCWS_FirePerime.json
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_FSR_Safety_Info.json
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_RecSitesReserve.json
