# Dashboard Layout Realignment

## Scope

- Dashboard only.
- No route work was done for Weather, Incidents, Maps, Discourse, or Configure in this pass.
- No local JSON dashboard truth was introduced.

## Source of truth used

- `dashboard.pdf` page 1 for layout target
- `open_fireside_dashboard_endpoints_v2.yaml` for canonical dashboard endpoint usage

## What changed

- Refined the dashboard layout toward the PDF page-1 composition:
  - wildfire overview map upper-left
  - four top-right stats cards: Active, New in 24, Out in 24, Out in 7
  - stage-of-control panel directly below the top stats
  - blank resources strip: Personnel, IMT, Aviation, Heavy, SPU
  - fire-centre totals table on the right
  - evacuation orders/alerts cards below the table
  - Discourse Signals stub lower-left
  - Pinned Incidents stub lower-right
- Removed the unsupported `Wildfires of Note` right-side stat card from the live layout.
- Kept the wildfire-of-note category only in the map legend and marker layer, which matches the manifest and PDF.
- Kept dashboard evacuation calls within the canonical `wfnews-arcgis` family and used the manifest-approved query shape.
- Locked dashboard stats and fire-centre calls to the manifest fire year:
  - `fireYear=2025`
- Removed positional fire-centre fallback logic so rows bind by exact fire-centre name only.
- Tightened the dashboard proportions in CSS only so the title block, map, right-side stack, and lower stub panels read closer to `dashboard.pdf` page 1 in the full-window shell.
- Left unsupported sections blank with em dashes only:
  - Personnel
  - IMT
  - Aviation
  - Heavy
  - SPU
- Kept Discourse Signals and Pinned Incidents as empty stub panels only.

## Endpoint usage after realignment

Dashboard data calls are limited to manifest-approved families:

- `/bcws-api/wfnews-api/statistics?fireYear=2025&fireCentre=BC`
- `/bcws-api/wfnews-api/statistics?fireYear=2025&fireCentre=<Cariboo|Coastal|Kamloops|Northwest|Prince George|Southeast Fire Centre>`
- `/bcws-api/wfnews-api/publicPublishedIncident/features?stageOfControl=FIRE_OF_NOTE`
- `/bcws-api/wfnews-api/publicPublishedIncident/features?stageOfControl=OUT_CNTRL`
- `/bcws-api/wfnews-api/publicPublishedIncident/features?stageOfControl=HOLDING`
- `/bcws-api/wfnews-api/publicPublishedIncident/features?stageOfControl=UNDR_CNTRL`
- `/wfnews-arcgis/services6/ubm4tcTYICKBpist/ArcGIS/rest/services/Evacuation_Orders_and_Alerts/FeatureServer/0/query?where=ORDER_ALERT_STATUS <> 'All Clear' and (EVENT_TYPE = 'Fire' or EVENT_TYPE = 'Wildfire')&outFields=*&returnGeometry=false&f=pjson`

## Verification run

1. `npm install`
2. `npm run dev -- --host 127.0.0.1 --port 4173`
3. Opened `#/dashboard` locally in a real headless Edge session
4. Confirmed map pan remained interactive
5. Confirmed zoom control still worked
6. Confirmed dashboard fetch/XHR URLs stayed within the manifest-approved endpoint set
7. Confirmed unsupported resource cards remained blank and no fabricated values appeared
8. Confirmed fire-centre rows were bound by exact name only
9. Captured final dashboard screenshot for `feedback.zip`

## Verification results

- Map interaction preserved:
  - map pane transform changed from `matrix(1, 0, 0, 1, 0, 0)` to `matrix(1, 0, 0, 1, -115, -19)` after drag
- Browser console errors during dashboard verification: none
- Dashboard data request set matched the manifest families only
- Fire-centre rows matched the exact approved display order and exact fire-centre names only:
  - Cariboo
  - Coastal
  - Kamloops
  - Northwest
  - Prince George
  - Southeast
- Layout is materially closer to `dashboard.pdf` page 1 than the previous dashboard state

## Files changed in this pass

- `src/styles.css`
- `docs/audits/dashboard-layout-realignment.md`
- `docs/audits/push-log.md`
