# Push Log

## 2026-03-16T03:25:00-07:00

- Commit message: `Reset the repo to Shell V2 and seed named preliminary sources`
- Short note: archived the prior working tree, replaced the repo root with the approved Shell V2 baseline, created the explicit per-source recon structure, and seeded the exact named preliminary sources into the registry
- Verification result: Shell V2 launched locally, the left rail and Configure pinned nav rendered, blank/minimal route bodies loaded, the exact source folder structure exists, the source registry contains the exact named preliminary URLs, the widget and page registry scaffolds parsed, and feedback.zip was rebuilt with screenshots and verification notes

## 2026-03-16T05:55:00-07:00

- Commit message: `Implement the BCWS perimeter widget in Configure Sources`
- Short note: added one verified widget in `Configure > Sources` backed only by the public BCWS Fire Perimeters ArcGIS layer, updated the single approved widget registry entry, and kept all other routes and tabs blank/minimal
- Verification result: the shell still launched with the same route structure, Configure rendered the BCWS perimeter widget, the widget fetched the verified ArcGIS source only, raw specimen inspection rendered, other routes stayed blank/minimal, and feedback.zip was rebuilt with screenshot and verification artifacts

## 2026-03-16T09:05:00-07:00

- Commit message: `Introduce widget objects and shared page builder surfaces`
- Short note: refactored widgets into first-class objects, expanded Configure with `Widgets` plus page-builder tabs, moved the BCWS perimeter widget behind the object model, and added the same shared builder controls to Dashboard, Incidents, Discourse, Environment, and Maps without promoting any widget to those pages
- Verification result: the shell still launched with the same routes, Configure rendered `Sources / Widgets / Dashboard / Incidents / Discourse / Environment / Maps`, the live widget object view rendered in `Configure > Widgets`, every page route exposed the same edit/add-column/add-widget controls, edit mode produced empty columns and empty widget slots on every page, no page route rendered the BCWS perimeter widget, the widget and page layout registries parsed, and feedback.zip was rebuilt with screenshots and verification JSON

## 2026-03-17T00:35:05-07:00

- Commit message: `Reconcile local BCWS endpoint work and remove patch residue`
- Short note: preserved the factual BCWS-backed dashboard, incidents, incident detail, and perimeter widget work; removed dead dashboard/incidents patch modules plus zip/script residue and generated junk; restored repo docs, handoff, Vite entry handling, and package identity so the repo is coherent again
- Verification result: `npm install`, `npm run build`, and `npm run dev -- --host 127.0.0.1 --port 4173` all passed; `#/dashboard`, `#/incidents`, and `#/configure` rendered successfully in a real headless Edge session; dashboard metrics repopulated from live endpoints, incidents loaded 500 factual rows, the perimeter widget rendered with object count 320, and no browser console errors were emitted during the route checks

## 2026-03-17T01:00:00-07:00

- Commit message: `Realign dashboard layout to manifest-backed page-one target`
- Short note: kept the pass dashboard-only, realigned the dashboard composition toward `dashboard.pdf` page 1, moved evacuation calls onto the canonical manifest path family, preserved the live wildfire overview map interaction, and left unsupported resource/discourse/pinned sections blank or stubbed
- Verification result: `npm install` and `npm run dev -- --host 127.0.0.1 --port 4173` passed; `#/dashboard` opened locally in a real headless Edge session; the map panned and zoomed successfully; dashboard fetch/XHR URLs were limited to the manifest-approved statistics, stage feature, and evacuation query endpoints; unsupported resource cards stayed blank; and the final dashboard screenshot plus verification artifacts were captured under `docs/audits/`

## 2026-03-17T01:20:00-07:00

- Commit message: `Make the Open Fireside shell fill the full browser window`
- Short note: removed the centered outer mockup frame, removed the width clamp and aspect-ratio constraint from the shell, expanded the shell to `100vw x 100vh`, kept the left rail fixed width, and let the workspace consume the remaining viewport width without changing dashboard data wiring or route logic
- Verification result: `npm run dev -- --host 127.0.0.1 --port 4173` passed; `#/dashboard` rendered with `app-shell` and `shell-frame` both measuring `1440 x 900` in a `1440 x 900` viewport; the left rail stayed fixed at `150px`; no centered letterboxed frame remained; and the dashboard map still panned successfully after the shell change
