# Reconciliation Pass

## Current local state found

- Local workspace had drifted far beyond the pushed shell baseline.
- Live endpoint-backed code existed locally for `Dashboard`, `Incidents`, incident detail, and the BCWS perimeter source widget, but it was mixed with partial patch residue and generated junk.
- Route and package identity were inconsistent: the repo still described itself as an empty shell in some places while the app had already grown live BCWS integrations.
- `vite` local dev had been destabilized by source specimen files being pulled into dependency scanning.

## Canonical pushed state found

- `origin/main` matched the shell-first baseline commit `18ec656` (`Introduce widget objects and shared page builder surfaces`).
- Canonical pushed behavior was:
  - shell navigation
  - object-model/page-builder surfaces
  - factual BCWS perimeter widget only in `Configure > Sources`
  - no live dashboard or incidents wiring yet

## Patch residues discovered

- Root-level patch artifacts:
  - `open-fireside-dashboard-interactive-patch.zip`
  - `open-fireside-incidents-dashboard-patch.zip`
  - `open-fireside-incidents-list-patch.zip`
  - `open-fireside-empty-shell-fixed.zip`
  - `apply-*.ps1`
  - `README-*-patch.md`
- Extracted patch workspace:
  - `open-fireside-dashboard-patch/`
- Captures and generated artifacts:
  - `*.har`
  - `dist/`
  - `node_modules/`
  - `output/`
  - prior `feedback.zip`
  - prior `recon.zip`
- Dead/unlinked source remnants from failed dashboard/incidents patching:
  - `src/dashboardApi.js`
  - `src/dashboardData.js`
  - `src/dashboardModel.js`
  - `src/incidentsData.js`
- Unused copied assets/data:
  - root fire-ban JSONs
  - loose root SVG/PNG files
  - unreferenced public logo/fire-ban files

## Factual endpoint-backed code preserved

### Dashboard

- Preserved live BCWS-backed dashboard wiring in [src/bcwsApi.js](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/bcwsApi.js) and [src/App.jsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/App.jsx).
- Preserved factual endpoint usage only:
  - `/bcws-api/wfnews-api/statistics`
  - `/bcws-api/wfnews-api/publicPublishedIncident`
  - `/wfnews-arcgis/.../BCWS_FirePerimeters_PublicView/.../query`
  - `/wfnews-arcgis/.../Evacuation_Orders_and_Alerts/.../query`
- Dashboard blocks now confirmed live:
  - fire year selection
  - active count
  - wildfire-of-note count
  - new/out counters
  - evacuation order/alert counts
  - stage distribution
  - fire-centre totals
- Allowed stubs kept:
  - `Discourse Signals`
  - `Incidents (pinned)`

### Incidents

- Preserved live incident list and detail wiring in [src/bcwsApi.js](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/bcwsApi.js) and [src/App.jsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/App.jsx).
- Preserved factual endpoint usage only:
  - `/bcws-api/wfnews-api/publicPublishedIncident/features`
  - `/bcws-api/wfnews-api/publicPublishedIncidentAttachment/.../attachments`
  - `/bcws-site/incidents?...`
  - `/bcws-api/wfnews-api/publicExternalUri`
- Confirmed live/factual incident surfaces:
  - incidents table list
  - incident status/centre/title/date fields
  - incident detail fetch path
  - factual gallery/attachment wiring

### Configure

- Preserved and repaired the factual perimeter widget/object path in:
  - [src/bcwsPerimeter.js](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/bcwsPerimeter.js)
  - [src/objectModel.js](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/objectModel.js)
  - [src/App.jsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/App.jsx)
- `Configure > Sources` still renders the live BCWS perimeter widget and current object count.
- `Configure > Widgets` and page-builder surfaces remain shell/object-model based.

## Broken or fabricated code removed

- Removed broken/unlinked dashboard patch modules:
  - `src/dashboardApi.js`
  - `src/dashboardData.js`
  - `src/dashboardModel.js`
  - `src/incidentsData.js`
- Removed fabricated or misleading dashboard residues from the live path:
  - duplicated evacuation panels
  - misleading resource strip counts
  - placeholder fire-ban/dashboard panels
  - stale snapshot/restriction plumbing not needed for factual rendering
- Removed shell drift that made the repo incoherent:
  - stale empty-shell metadata in `index.html`
  - stale handoff instructions that no longer matched the preserved factual routes
- Kept `Weather`, `Maps`, and `Discourse` intentionally blank.

## Workspace cleanup performed

- Added repo junk ignores in [.gitignore](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/.gitignore).
- Deleted patch zips, patch scripts, extracted patch folders, HAR captures, generated output folders, and dead copied assets.
- Removed old tracked `recon.zip`; replaced old tracked `feedback.zip` with a fresh package built from this pass.
- Kept repo identity coherent:
  - package name normalized to `open-fireside`
  - README and handoff updated to match the actual shell-first plus factual-exception state
- Fixed dev-server stability in [vite.config.js](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/vite.config.js) by locking Vite to the app entry instead of crawling specimen HTML under `sources/`.

## Final repo state

- Shell-first repo restored.
- Live and factual:
  - `#/dashboard`
  - `#/incidents`
  - incident detail route
  - `Configure > Sources` BCWS perimeter widget
- Intentionally blank/stubbed:
  - `#/weather`
  - `#/maps`
  - `#/discourse`
  - dashboard `Discourse Signals`
  - dashboard `Incidents (pinned)`
- No fabricated summaries, fake metrics, fake fire-centre logic, or placeholder dashboard panels remain in the live path.

## Exact verification steps run

1. `npm install`
2. `npm run build`
3. `npm run dev -- --host 127.0.0.1 --port 4173`
4. `curl.exe -I http://127.0.0.1:4173/`
5. Opened `http://127.0.0.1:4173/#/dashboard` in a real headless Edge session via Playwright runtime and confirmed:
   - dashboard rendered
   - live values populated
   - current fire year resolved to `2025`
   - active count rendered as `23`
   - evacuation counts rendered
   - fire-centre totals rendered
6. Opened `http://127.0.0.1:4173/#/incidents` in a real headless Edge session via Playwright runtime and confirmed:
   - incident table rendered
   - `500` list rows loaded
   - factual BCWS rows were present
7. Opened `http://127.0.0.1:4173/#/configure` in a real headless Edge session via Playwright runtime and confirmed:
   - `Sources` and `Widgets` tabs rendered
   - BCWS perimeter widget rendered
   - live perimeter object count rendered as `320`
8. Confirmed no console errors were emitted during the route checks.
9. Confirmed `npm run build` completed without broken imports.
