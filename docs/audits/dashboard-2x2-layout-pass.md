# Dashboard 2x2 Layout Pass

## Scope

Dashboard only. No route changes. No changes to Weather, Incidents, Maps, Discourse, or Configure.

## Source of truth used

- `AGENTS.md`
- `open_fireside_dashboard_endpoints_v2.yaml`
- `dashboard.pdf` page 1
- local asset bundle `Open Fireside assets.zip`

## What changed

- Reshaped the dashboard workspace into a clear 2x2 composition:
  - top-left: live `Wildfire Overview` map
  - top-right: stats, stage-of-control, fire-centre totals, blank resource strip, evacuation cards
  - bottom-left: `Discourse Signals` stub
  - bottom-right: `Pinned Incidents` stub
- Kept the left rail and route structure unchanged.
- Tightened title, panel spacing, border treatment, and sizing to match `dashboard.pdf` page 1 more closely.
- Preserved the live interactive Leaflet map.
- Kept unsupported sections blank.
- Reused the provided stage marker assets for the dashboard legend and stage controls, including a new tracked [fire-of-note.svg](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/public/fire-of-note.svg) asset from the local bundle.

## Files changed in this pass

- [src/App.jsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/App.jsx)
- [src/styles.css](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/styles.css)
- [public/fire-of-note.svg](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/public/fire-of-note.svg)

## Data truth preserved

- Map markers still come only from the approved stage feature endpoints.
- `Active` remains derived from:
  - `activeOutOfControlFires`
  - `activeBeingHeldFires`
  - `activeUnderControlFires`
- `New in 24`, `Out in 24`, and `Out in 7` remain mapped to the statistics endpoint fields only.
- Fire-centre rows still bind by exact fire-centre name only.
- Evacuation Orders and Alerts still derive only from the approved ArcGIS evacuation query.
- `Discourse Signals` and `Pinned Incidents` remain stubbed.
- `Resources deployed`, `Cat 1`, `Cat 2`, `Cat 3`, and `Forest use` remain blank.

## Verification run

- `npm install`
- `npm run dev -- --host 127.0.0.1 --port 4173`
- Opened `#/dashboard` locally in a real browser session
- Confirmed the dashboard reads as a 2x2 workspace
- Confirmed the map still pans and zooms
- Confirmed dashboard fetch/XHR calls stayed inside these endpoint families only:
  - `/bcws-api/wfnews-api/statistics`
  - `/bcws-api/wfnews-api/publicPublishedIncident/features`
  - `/wfnews-arcgis/services6/ubm4tcTYICKBpist/ArcGIS/rest/services/Evacuation_Orders_and_Alerts/FeatureServer/0/query`
- Confirmed unsupported sections remained blank/stubbed
- Confirmed no fabricated values appeared

## Final state

The dashboard is now closer to the mockup in structure and proportion while keeping the existing live wiring unchanged.
