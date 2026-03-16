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
