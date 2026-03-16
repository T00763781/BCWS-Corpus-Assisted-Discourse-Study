# Push Log

## 2026-03-15T23:19:34-07:00

- Commit hash: `61f28ed81560bcaf131e449180516c1408b12050`
- Commit message: `Replace legacy BCWS repo with Open Fireside baseline and API contract`
- Short note: replaced the legacy tracked BCWS pilot tree with the Open Fireside workstation baseline and mounted the backend contract under `/api`
- Verification result: `pytest tests` passed; `/api/health`, `/api/connectors`, `/api/analytics/snapshot`, and `/api/conditions` all returned success

## 2026-03-15T23:21:34-07:00

- Commit hash: `c8b59fdc3c85b6ad5b25390284b90ef180d9ec66`
- Commit message: `Wire desktop workspace to the /api contract`
- Short note: moved the desktop client onto the canonical `/api` namespace, added a Vite proxy, and fixed the UI region fallback rendering
- Verification result: `npm --workspace apps/desktop run build` passed; headless browser output from `http://localhost:1420` showed live KPI and conditions data with no failed-fetch state

## 2026-03-15T23:22:23-07:00

- Commit hash: `932542ba3bbe866f0ab016073df69d90df55d30e`
- Commit message: `Harden Windows bootstrap and seed-demo launch paths`
- Short note: added `.cmd` wrappers for Windows-safe script execution and hardened `seed-demo` to wait for API readiness and emit diagnostics
- Verification result: `cmd /c scripts\bootstrap\seed-demo.cmd` completed successfully and `.diagnostics/latest/seed-demo.log` was written

## 2026-03-15T23:26:44-07:00

- Commit hash: `d40b920f2074e978e4014e7360093d9ee40df617`
- Commit message: `Document runtime repair and package operator feedback bundle`
- Short note: updated the README and operator docs to the canonical `/api` and `.cmd` flow, wrote the runtime repair audit, and packaged `feedback.zip`
- Verification result: `feedback.zip` contains the runtime audit, next steps, verification log, and relevant runtime logs

## 2026-03-16T00:16:25-07:00

- Commit hash: `340ff49dd2ce648ec94690ad405394fc47a94779`
- Commit message: `Refactor the workstation shell to the mockup route structure`
- Short note: replaced the interim desktop navigation with the approved route-level IA for Dashboard, Incidents, Discourse, Environment, Maps, and Configure
- Verification result: `pytest tests` passed and the workstation shell loaded with the new route structure against the repaired `/api` contract

## 2026-03-16T00:19:21-07:00

- Commit hash: `dce30272d38244b65d612b5187cf08cef255bbc4`
- Commit message: `Add incident-centric API models and persistence scaffolding`
- Short note: introduced incident, restriction, update, map asset, discourse-link, and fire-centre outlook entities plus incident/dashboard/environment/maps API routes
- Verification result: `pytest tests` passed and `/api/dashboard/overview`, `/api/incidents`, `/api/incidents/G70422`, `/api/environment/overview`, and `/api/maps/catalog` returned structured incident-first payloads

## 2026-03-16T00:23:35-07:00

- Commit hash: `529e345ba723da28ce6fa426860034afb40287d7`
- Commit message: `Normalize BCWS and environment data into the incident spine`
- Short note: normalized BCWS, CWFIS, GeoMet, and seed discourse data into the incident domain so known wildfire and environment sources land coherently in incident detail and dashboard summaries
- Verification result: `scripts\bootstrap\seed-demo.cmd` completed successfully, `pytest tests` passed, and the normalized APIs returned 11 seeded incidents with populated updates, restrictions, map assets, and environment context

## 2026-03-16T00:54:11-07:00

- Commit hash: `4f560fc9fffed2bf9a2b61e423ddff82baf8b652`
- Commit message: `Implement incident-first dashboard and workspace UI`
- Short note: mapped the UI template pack into the real desktop client, added incident list/detail workspaces, and wired dashboard, environment, and maps surfaces to live incident/environment APIs
- Verification result: `npm --workspace apps/desktop run build` passed outside the sandbox, headless Edge DOM captures showed live dashboard/incidents/environment/maps content, and a `social.seed` connector run increased `connector_runs` from `39` to `40`
