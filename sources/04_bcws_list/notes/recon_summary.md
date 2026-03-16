# Recon Summary

- source label: BC Wildfire Situation List
- canonical URL: https://wildfiresituation.nrs.gov.bc.ca/list
- what the page appears to provide: List-oriented route inside the same BC Wildfire Service Angular application shell used by dashboard and map.
- likely data-bearing endpoint families:
  - Published incident API family for list rows and status fields.
  - Situation report and attachment/external URI families for supporting detail.
  - Shared ArcGIS layer families still appear in the common bundle even if the route itself is list-oriented.
- likely map/layer families:
  - Fire perimeter layer family shared with the map route.
  - Shared ArcGIS support layers discoverable in the common bundle.
- specimen status: 3 saved
- auth/cors/anti-automation observations if relevant: Public route shell. Bundle references NRS API families, but the primary NRS API hostnames did not resolve from this environment.
- widget candidate ideas:
  - Incident list table: List route strongly implies this family, but host resolution remains unresolved from this environment.
  - Incident attachment links: Attachment families are bundle-level findings only.
  - Situation report links: Situation report family is bundle-level only from this environment.
- confidence level: medium
- recommendation: pursue

## specimen files
- specimens\https_wildfiresituation_nrs_gov_bc_ca_list.html
- specimens\https_wildfiresituation_nrs_gov_bc_ca_main_da9882e70a9138f1_js.js
- specimens\https_services6_arcgis_com_ubm4tcTYICKBpist_ArcGIS_rest_services_BCWS_FirePerime.json
