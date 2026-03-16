# Incident UI Phase Audit

## Mockup alignment decisions implemented

- Mapped the desktop workstation onto the approved route-level IA: `Dashboard`, `Incidents`, `Discourse`, `Environment`, `Maps`, and `Configure`.
- Replaced the interim placeholder shell with an incident-first workspace that uses a left navigation rail, dashboard overview panels, incident catalog, and compact incident detail header consistent with the template pack.
- Implemented the incident detail workspace as tabbed subviews: `Response`, `Gallery`, `Maps`, and `Discourse`.
- Kept discourse structurally subordinate to incident and fire-centre context instead of making it the primary organizing object.
- Preserved the existing serious visual posture while shifting the layout, panel hierarchy, and surface organization toward the uploaded template pack and mockup PDF.

## Incident model and entities introduced or changed

- Added first-class API entities for `Incident`, `IncidentUpdate`, `IncidentRestriction`, `IncidentMapAsset`, `IncidentEnvironmentContext`, `IncidentDiscourseLink`, and `FireCentreOutlook`.
- Exposed typed API contracts for:
  - `GET /api/dashboard/overview`
  - `GET /api/incidents`
  - `GET /api/incidents/{fire_number}`
  - `GET /api/environment/overview`
  - `GET /api/maps/catalog`
- Hardened the desktop API client to consume the actual serialized incident, environment, and maps contracts instead of the earlier placeholder analytics-only model.

## Connectors and data sources normalized in this phase

- BCWS incident catalog and seeded incident detail data now land into the incident spine with fire number, wildfire name, stage of control, size, discovered date, updated timestamp, fire centre, cause, restrictions, updates, and map references.
- BCWS perimeter references and incident geometry references attach to incident detail and map surfaces.
- Evacuation alert and area restriction records land into incident restrictions for `G70422`.
- CWFIS and GeoMet context remain available through environment overview and condition feeds; GeoMet fire-centre outlooks now render on the dashboard and environment route.
- Seed discourse remains attached through incident-linked discourse summaries rather than acting as a top-level organizing model.

## Routes and pages added or changed

- Refactored the desktop route tree in [App.tsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/apps/desktop/src/App.tsx).
- Updated the typed client in [api.ts](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/apps/desktop/src/lib/api.ts) to consume dashboard, incidents, environment, and maps endpoints.
- Replaced the interim styling with template-mapped production CSS in [styles.css](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/apps/desktop/src/styles.css).
- Implemented:
  - dashboard overview surface backed by `dashboard/overview` and `environment/overview`
  - searchable/sortable incidents list backed by `incidents`
  - incident detail workspace for `G70422` and other fire numbers backed by `incidents/{fire_number}`
  - environment route-level surface backed by fire-centre outlooks and latest conditions
  - maps route-level surface backed by `maps/catalog`
  - configure control-plane surface with study/source/linking/diagnostic framing

## Verification steps actually run

- `.\.venv\Scripts\python.exe -m pytest tests`
- `scripts\bootstrap\seed-demo.cmd`
- `cmd /c .\node_modules\.bin\tsc.cmd -p apps/desktop/tsconfig.json --noEmit`
- `cmd /c npm.cmd --workspace apps/desktop run build`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/environment/overview`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/incidents/G70422`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/maps/catalog`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/analytics/snapshot`
- `Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://127.0.0.1:8765/api/connectors/run -ContentType 'application/json' -Body '{"connector_key":"social.seed"}'`
- Headless Edge DOM captures against:
  - `http://127.0.0.1:1420/#/dashboard`
  - `http://127.0.0.1:1420/#/incidents`
  - `http://127.0.0.1:1420/#/incidents/G70422`
  - `http://127.0.0.1:1420/#/environment`
  - `http://127.0.0.1:1420/#/maps`
- Headless Edge screenshots captured for:
  - dashboard
  - incident detail `G70422`

## What succeeded

- Desktop route structure now matches the incident-first IA from the template pack.
- Dashboard renders live incident counts, evacuation and restriction counts, pinned incidents, fire-centre matrix data, and GeoMet outlook summaries.
- Incidents route renders a real searchable/sortable incident list with 11 incidents from the normalized dataset.
- Incident detail for `G70422` renders real response summary, restrictions, updates, geometry references, map references, and linked discourse context.
- Environment route renders outlook cards and current condition records from the live API.
- Maps route renders incident-linked map assets from the live API.
- Connector mutation remains live: running `social.seed` moved `connector_runs` from `39` to `40`, and the updated value rendered in route captures.

## What remains for discourse phase

- Expand discourse ingestion beyond the current seed data while keeping it bound to incident or fire-centre context.
- Add stronger incident-to-discourse linking logic and UI filtering by fire number, fire centre, and discourse type.
- Replace current discourse summary placeholders with richer claim, actor, and narrative views once more discourse sources are normalized.

## Risks and TODOs

- The environment route currently surfaces many BCWS endpoint-candidate rows because the normalized condition feed still includes catalog-discovery records; a later pass should curate these into more operator-readable environment slices.
- The dashboard and maps surfaces intentionally use structural placeholders for geographic visualization; a later pass should replace those placeholders with real mapped layers without breaking the route-level IA.
- The frontend now matches the current backend contract; if the API schemas evolve again, update the typed client and route renderers together to avoid silent blank fields.
- `vite build` and live browser verification required unsandboxed execution on Newton because `esbuild` and headless Edge hit local sandbox restrictions.
