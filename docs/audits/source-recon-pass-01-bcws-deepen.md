# Source Recon Pass 01 BCWS Deepen

## Exact BCWS Sources Inspected

1. https://wildfiresituation.nrs.gov.bc.ca/dashboard
2. https://wildfiresituation.nrs.gov.bc.ca/map
3. https://wildfiresituation.nrs.gov.bc.ca/list

## What Changed From Pass-01

- Re-ran bounded recon for the BCWS cluster only.
- Treated the three routes as one shared Angular shell with route-specific emphasis rather than as separate unrelated sources.
- Added direct ArcGIS metadata, count, and sample-query specimens for:
  - `BCWS_FirePerimeters_PublicView`
  - `FSR_Safety_Information_View`
  - `RecSitesReservesInterpForests_DetailsClosures_publicView`
- Extracted bundle snippets showing:
  - `createPublishedIncident`
  - `incidentSituation.stageOfControlCode`
  - attachment, external URI, situation report, notification, file-details, and geocoder families
- Explicitly separated verified concrete services from probable or unresolved NRS families.

## Verified Endpoint Family Table

| family | route use | verification | notes |
| --- | --- | --- | --- |
| `https://wildfiresituation.nrs.gov.bc.ca/main.da9882e70a9138f1.js` | dashboard / map / list | verified | Shared Angular shell bundle across all three routes. |
| `https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0` | dashboard / map / list | verified | Public polygon layer. Query count `320`. Fields include `FIRE_STATUS`, `FIRE_SIZE_HECTARES`, `FIRE_URL`. |
| `https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/FSR_Safety_Information_View/FeatureServer/0` | dashboard / map | verified | Public point layer. Query count `100`. Alert domain values include `CLOSURE`, `WARNING`, `SEASONAL`. |
| `https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/RecSitesReservesInterpForests_DetailsClosures_publicView/FeatureServer/0` | dashboard / map | verified | Public point layer. Query count `2272`. Fields include `CLOSURE_IND`, `CLOSURE_TYPE`, `CLOSURE_DATE`. |

## Probable Or Unresolved Endpoint Family Table

| family | route use | status | notes |
| --- | --- | --- | --- |
| `https://wfim.nrs.gov.bc.ca/v1/publishedIncident` | dashboard / map / list | unresolved | Bundle exposes the client family and `incidentSituation.stageOfControlCode`, but hostname did not resolve from this environment. |
| `https://wfnews.nrs.gov.bc.ca/v1/situationReport` | dashboard / list | unresolved | Bundle client family present; hostname did not resolve from this environment. |
| `https://wfone.nrs.gov.bc.ca/v1/notification` | dashboard / map | unresolved | Bundle client family present; hostname did not resolve from this environment. |
| `https://resources.wfdm.nrs.gov.bc.ca/fileDetails` | dashboard emphasis | unresolved | Bundle reference present; hostname did not resolve from this environment. |
| `https://wfim.nrs.gov.bc.ca/v1/attachment` | list emphasis | unresolved | Bundle reference present; hostname did not resolve from this environment. |
| `https://wfim.nrs.gov.bc.ca/v1/externalUri` | list emphasis | unresolved | Bundle reference present; hostname did not resolve from this environment. |
| `https://geocoder.api.gov.bc.ca/addresses.geojsonp` | map emphasis | probable | Bundle reference indicates map search usage, but no direct live request was captured in this pass. |
| evacuation-related overlay family | map emphasis | unresolved | Only evacuation-related copy text was surfaced from the bundle. No concrete service URL was isolated. |

## Shared Vs Source-Specific Breakdown

### Shared across dashboard / map / list

- Shared shell bundle: `main.da9882e70a9138f1.js`
- Shared NRS family evidence:
  - `publishedIncident`
  - `situationReport`
  - `notification`
- Shared public ArcGIS layer evidence:
  - fire perimeters
  - forest service road safety
  - recreation closures
- Shared structure evidence:
  - `incidentSituation.stageOfControlCode` in the bundle
  - `FIRE_STATUS` in the perimeter layer

### Source-specific emphasis

- `bcws_dashboard`
  - file-details and file-metadata resource families surfaced in the shared bundle and matter most for dashboard-adjacent supporting assets.
- `bcws_map`
  - BC geocoder family surfaced as a map-search dependency.
  - No concrete evacuation layer was isolated despite evacuation-related copy text.
- `bcws_list`
  - attachment and external URI families surfaced most clearly for list/detail behavior.

## First-Widget Candidate Shortlist

These remain candidate-only.

| widget candidate | strongest route | basis | status |
| --- | --- | --- | --- |
| Perimeter map layer | map | Verified public polygon ArcGIS service | candidate_only |
| Road-safety overlay | map | Verified public point ArcGIS service with alert-type domains | candidate_only |
| Recreation closures overlay | map | Verified public point ArcGIS service with closure fields | candidate_only |
| Perimeter-backed incident count | dashboard | Verified public perimeter layer | candidate_only |
| Stage-of-control counts | dashboard | Bundle stage-of-control structure plus perimeter `FIRE_STATUS`, but blocked by unresolved incident API | candidate_only |
| Incident list table | list | Natural fit if the published-incident API becomes reachable | candidate_only |

## Risks And Caveats

- The three strongest candidates are overlay or layer candidates because their backing ArcGIS services are directly verified.
- The higher-value dashboard or incidents-table candidates still depend on unresolved NRS hosts.
- Public perimeter `FIRE_STATUS` may be enough for some first-generation counts, but that still needs validation against the unresolved incident payload family.
- No evacuation service URL was isolated in bounded recon, so evacuation remains explicitly unverified.

## Boundary

No widgets were implemented in this pass.
No shell routes, page bodies, or visible Configure UI content were changed in this pass.
