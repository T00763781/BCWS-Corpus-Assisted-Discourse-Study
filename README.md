# Open Fireside

Open Fireside is a production-grade, local-first wildfire discourse workstation for Windows 11.

It is designed for BC wildfire discourse research with a single operator surface, a single local database,
and multiple internal connectors for environment, GIS, and social media sources.

## What v1 includes

- Tauri desktop shell with a React/TypeScript analyst workspace
- FastAPI local service layer with typed contracts and structured diagnostics
- Local-first PostgreSQL-ready schema with SQLite developer fallback
- Connector SDK plus first-pass environment and social connectors
- PowerShell bootstrap and diagnostics bundle generation for Newton
- A unified workstation with:
  - Live Conditions
  - Discourse Feed
  - Actors
  - Claims
  - Analysis

## Repository posture

This codebase is intentionally **not** an MVP scaffold. It is structured as a production-grade internal workstation
with phased feature exposure and durable contracts.

## Runtime contract

- Backend base: `http://127.0.0.1:8765`
- Canonical API namespace: `http://127.0.0.1:8765/api/*`
- Friendly backend root: `http://127.0.0.1:8765/` redirects to `/docs`
- Desktop web workspace: `http://localhost:1420`
- Development proxy: the Vite dev server proxies `/api` to the backend, so the frontend does not call the backend with a hard-coded cross-origin URL

## Quick start

Use the Windows-safe wrappers from a fresh `cmd.exe` or PowerShell session:

```powershell
.\scripts\bootstrap\bootstrap.cmd -CreateVenv -InstallNodePackages
.\scripts\bootstrap\run-api.cmd
.\scripts\bootstrap\seed-demo.cmd
npm --workspace apps/desktop run dev
```

Operator notes:

- `seed-demo.cmd` waits for `/api/health` before running connectors
- legacy root routes such as `/connectors` redirect to `/api/connectors`, but `/api/*` is the supported contract
- diagnostics and seed logs are written under `.diagnostics/latest`

## Documentation

- [Newton quickstart](docs/operator/NEWTON_QUICKSTART.md)
- [Operator test loop](docs/operator/TEST_LOOP.md)
- [Runtime repair audit](docs/audits/runtime-repair-audit.md)
