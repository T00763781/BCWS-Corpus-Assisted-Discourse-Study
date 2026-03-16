# Runtime Repair Audit

## Root causes

1. The backend only mounted root routes such as `/connectors` and `/analytics/snapshot`, while the workstation and manual verification expected `/api/*`.
2. The frontend called `http://127.0.0.1:8765` directly, which created a dev-time cross-origin path from `http://localhost:1420`.
3. FastAPI CORS middleware was configured with `allow_origins=["*"]` and `allow_credentials=True`, which is not a valid browser-facing combination for the observed desktop web flow.
4. `GET /conditions` returned detached SQLAlchemy rows after commit because the session expired ORM instances before response serialization.
5. Fresh Windows sessions could fail to run `seed-demo.ps1` because the workflow depended on invoking `.ps1` files directly under local execution policy defaults.

## Files changed

- Backend contract and runtime: `packages/config/open_fireside_config/settings.py`, `services/api/open_fireside_api/main.py`, `services/api/open_fireside_api/database.py`
- Frontend integration: `apps/desktop/src/App.tsx`, `apps/desktop/src/lib/api.ts`, `apps/desktop/src/vite-env.d.ts`, `apps/desktop/vite.config.ts`
- Windows bootstrap: `scripts/bootstrap/run-api.ps1`, `scripts/bootstrap/launch-workstation.ps1`, `scripts/bootstrap/seed-demo.ps1`, `scripts/bootstrap/*.cmd`
- Operator docs and audit trail: `README.md`, `docs/operator/NEWTON_QUICKSTART.md`, `docs/operator/TEST_LOOP.md`, `docs/audits/*`, `scripts/diagnostics/package-feedback.ps1`
- Repository normalization: removed legacy tracked BCWS pilot files and replaced the repo with the Open Fireside workstation tree

## Exact verification steps performed

1. Confirmed git remote, branch, and working tree state.
2. Read the FastAPI entrypoint, routers, settings, frontend API client, Vite config, and bootstrap scripts.
3. Started the backend on `http://127.0.0.1:8765` and verified:
   - `/health` returned `ok`
   - `/api/health` initially returned `404`
   - `/api/connectors` initially returned `404`
   - CORS headers on root routes returned `access-control-allow-origin: *` with `access-control-allow-credentials: true`
4. Reproduced the `/conditions` failure and captured the `DetachedInstanceError`.
5. Patched the backend to mount the canonical API contract under `/api`, added legacy redirects, constrained CORS origins, and disabled SQLAlchemy expiration on commit.
6. Patched the desktop client to use `/api` and added a Vite `/api` proxy.
7. Added Windows-safe `.cmd` wrappers and hardened `seed-demo.ps1` to wait for `/api/health` and emit diagnostics.
8. Verified the backend, frontend build, seed flow, and live browser rendering again.

## Commands run

- `git remote -v`
- `git branch --show-current`
- `git status --short --branch`
- `rg --files`
- `.\\.venv\\Scripts\\python.exe -m pytest tests`
- `npm --workspace apps/desktop run build`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/health`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/connectors`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/analytics/snapshot`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/conditions`
- `@' ... '@ | .\\.venv\\Scripts\\python.exe -` to reproduce the detached-instance failure with `TestClient`
- `& 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom http://localhost:1420`
- `cmd /c scripts\\bootstrap\\seed-demo.cmd`
- `git commit ...`
- `git push origin main`

## What succeeded

- The GitHub remote now points to Open Fireside instead of the legacy BCWS pilot tree.
- The backend now serves the canonical API contract under `/api/*`.
- `http://127.0.0.1:8765/` redirects to `/docs`.
- Legacy root paths redirect to `/api/*`, which preserves local compatibility while leaving one supported namespace.
- Dev CORS now returns an explicit `access-control-allow-origin: http://localhost:1420`.
- `GET /api/conditions` no longer throws `DetachedInstanceError`.
- The desktop client loads from `http://localhost:1420` without the earlier `Failed to fetch` state.
- A live connector run increased the visible UI KPI count from `16` to `17` in a headless browser dump.
- `cmd /c scripts\\bootstrap\\seed-demo.cmd` completed successfully and wrote `.diagnostics/latest/seed-demo.log`.

## What remains unresolved

- The local working directory still contains untracked archive artifacts (`99_Archive/`, `open-fireside.zip`) that are not part of the committed repo. They do not affect the pushed remote, but they should be removed in a future cleanup pass if local shell policy allows destructive cleanup without friction.
- The verification pass exercised the desktop web surface and API, but it did not run the Tauri desktop shell itself.

## Risks / TODOs

- `social.seed` appends new discourse rows on every run. That is useful for operator verification, but future passes should decide whether seed connectors should be idempotent.
- The current connector set is still scaffold-heavy; live polling, deduplication, and richer discourse inspection remain product work, not repair work.
- Consider adding automated HTTP smoke tests for the seed workflow and a browser-level regression test for the desktop web view.
