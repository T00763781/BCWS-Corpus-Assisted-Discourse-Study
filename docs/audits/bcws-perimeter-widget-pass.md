# BCWS Perimeter Widget Pass

## Exact Source URL Used

`https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0`

## Exact Fields Surfaced

- `FIRE_NUMBER`
- `FIRE_STATUS`
- `FIRE_SIZE_HECTARES`
- `FIRE_URL`
- metadata-derived field list from the layer definition
- metadata-derived `name`
- metadata-derived `geometryType`
- count-query-derived object count

## What The Widget Displays

- widget title: `BCWS Fire Perimeters PublicView`
- canonical source URL
- fetch state
- metadata HTTP status
- count HTTP status
- specimen HTTP status
- last fetched timestamp
- layer name
- geometry type
- object count
- available fields summary
- specimen attribute table using real returned records only
- raw specimen JSON in an expandable block
- refresh control

## What Was Intentionally Not Implemented

- no widget promotion outside `Configure > Sources`
- no Dashboard widget
- no Incidents widget
- no Maps widget
- no unresolved `wfim`, `wfnews`, or `wfone` usage
- no mock data or seeded fallback data
- no extra controls beyond the minimal fetch surface

## Verification Steps Run

- `npm run dev -- --host 127.0.0.1 --port 4173`
- local shell fetch check at `http://127.0.0.1:4173/`
- headless DOM capture at `http://127.0.0.1:4173/#/configure`
- direct widget-source fetches from the browser-based widget to the verified ArcGIS layer
- `npm run build`

## Fetch CORS Or Service Caveats

- The widget fetches only the verified public ArcGIS service and its `/query` endpoint.
- If the service or browser fetch fails, the widget shows the failure state plainly and does not fall back to fabricated data.
- The widget does not label the source as real-time; it only shows fetched state and timestamp.

## Boundary Confirmation

No other widgets were implemented in this pass.
No routes were changed in this pass.
Dashboard, Incidents, Discourse, Environment, and Maps remain blank/minimal.
