# Configure Control Plane Pass

## What content was removed from each page

- `Dashboard`: removed the KPI cards, pinned incidents list, fire-centre matrix, and the dashboard map placeholder copy that implied routed operational content.
- `Incidents`: removed the searchable incident table, filters, sort controls, incident drill-in path, and all incident detail subviews.
- `Discourse`: removed the incident-linked discourse target list and any preview surface that implied discourse objects were ready for display.
- `Environment`: removed outlook cards, latest-condition records, and any environment summaries.
- `Maps`: removed incident map tabs, asset galleries, and reference links. Kept only a neutral map container shell.

## Shell and sidebar changes

- Removed `Connector posture` from the left rail.
- Removed `Live posture` from the left rail.
- Kept the left navigation aligned to the approved route structure only:
  - `Dashboard`
  - `Incidents`
  - `Discourse`
  - `Environment`
  - `Maps`
  - `Configure`
- Shifted the shell styling away from the workstation/dev-console treatment into a cleaner mockup-aligned rail and workspace surface.

## How Configure now governs validation and promotion

- `Configure` is now the control plane instead of a generic settings page.
- The workspace area includes a pinned top nav with:
  - `Sources`
  - `Dashboard`
  - `Incidents`
  - `Discourse`
  - `Environment`
  - `Maps`
- `Sources` is the first tab and the starting point for future widget introduction.
- Configure explicitly frames the fields needed before promotion:
  - approved source class
  - source family / official URL class
  - object type
  - provenance status
  - validation status
  - page eligibility
- Downstream pages remain neutral until an object is promoted from Configure into a specific route-level widget.

## Proposed object lifecycle

1. `raw ingest object`
2. `normalized object`
3. `validated object`
4. `page-eligible object`

Lifecycle intent:
- Raw ingest objects can exist without product-surface exposure.
- Normalization records the object type, source family, and official URL class.
- Validation checks provenance and promotion rules.
- Page eligibility is an explicit final gate, not an assumption.

## What remains intentionally absent until live-source validation is complete

- No truth-bearing widgets on `Dashboard`, `Incidents`, `Discourse`, `Environment`, or `Maps`.
- No fabricated counts, summaries, discourse previews, or seeded operational cards.
- No live-source ingestion workflow in Configure yet.
- No widget-by-widget promotion from ArcGIS, NRS, or other approved government sources in this pass.
- No repopulation of stripped pages beyond neutral shells and headings.

## Verification steps run

- `cmd /c .\node_modules\.bin\tsc.cmd -p apps/desktop/tsconfig.json --noEmit`
- `G:\04_Dev-Tools\01_Tools\01_OpenFireside\.venv\Scripts\python.exe -m pytest tests`
- `Start-Process powershell ... -File scripts\bootstrap\run-api.ps1`
- `Start-Process powershell ... -Command "cmd /c npm.cmd --workspace apps/desktop run dev -- --host 127.0.0.1 --port 1420"`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/health`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:1420`
- `cmd /c npm.cmd --workspace apps/desktop run build`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/dashboard`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/incidents`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/discourse`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/environment`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/maps`
- `msedge.exe --headless=new --disable-gpu --screenshot=... http://127.0.0.1:1420/#/configure`
- `msedge.exe --headless=new --disable-gpu --dump-dom http://127.0.0.1:1420/#/dashboard`
- `msedge.exe --headless=new --disable-gpu --dump-dom http://127.0.0.1:1420/#/configure`

## Verification results

- Frontend started on `http://127.0.0.1:1420`.
- Backend started on `http://127.0.0.1:8765` and `/api/health` returned `{"status":"ok","app":"open-fireside-api"}`.
- TypeScript no-emit validation passed.
- `pytest tests` passed with `9 passed`.
- Production frontend build passed after rerunning outside the sandbox because sandboxed `vite build` failed with `Error: spawn EPERM` from `esbuild`.
- Rendered DOM for `#/dashboard` showed only the approved left-nav route structure and a neutral page body.
- Rendered DOM for `#/configure` showed the pinned top nav with `Sources`, `Dashboard`, `Incidents`, `Discourse`, `Environment`, and `Maps`, with `Sources` active by default.
- Route screenshots were captured for `Dashboard`, `Incidents`, `Discourse`, `Environment`, `Maps`, and `Configure`.

## Notes

- Headless Edge screenshot capture required unsandboxed execution on this host so the browser could write its profile and image artifacts successfully.
