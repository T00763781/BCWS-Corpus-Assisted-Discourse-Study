# Recon Summary

- source label: BC Wildfire Situation Dashboard
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/dashboard
- what the page appears to provide: BC Wildfire Service dashboard route inside a shared Angular application shell.
- likely data-bearing endpoint families:
  - Angular bundle strings reference NRS API families for published incidents, attachments, situation reports, notifications, and file metadata.
  - Public ArcGIS feature layers for fire perimeters, forest service road safety information, and recreation closures are discoverable from the same bundle.
  - Bundle also points to BC Wildfire blog WP JSON and BC geocoder families as auxiliary sources.
- likely map/layer families:
  - BCWS_FirePerimeters_PublicView feature layer.
  - FSR_Safety_Information_View feature layer.
  - RecSitesReservesInterpForests_DetailsClosures_publicView feature layer.
- specimen status: 5 saved
- auth/cors/anti-automation observations if relevant: Public page shell. ArcGIS layer metadata is fetchable. The NRS API hostnames referenced in the bundle did not resolve from this environment, so they remain unverified families.
- widget candidate ideas:
  - Wildfire overview totals: Depends on resolving the published incident API family.
  - Situation report summary: Bundle-level family only; unresolved hostname in this environment.
  - Perimeter-backed incident count: Public ArcGIS layer is accessible, but dashboard derivation still needs validation.
  - Notification summary: Notification family is referenced but unresolved from this environment.
- confidence level: medium
- recommendation: pursue

## specimen files
- specimens\https_wildfiresituation_nrs_gov_bc_ca_dashboard.html
- specimens\https_wildfiresituation_nrs_gov_bc_ca_main_da9882e70a9138f1_js.js
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_BCWS_FirePerime.json
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_FSR_Safety_Info.json
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_RecSitesReserve.json
