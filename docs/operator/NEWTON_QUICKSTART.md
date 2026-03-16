# Newton Quickstart

## Recommended local layout

- Keep the repo on the internal SSD
- Set `OPEN_FIRESIDE_DATA_DIR` to an external SSD if you expect heavy captures
- Run bootstrap from Windows PowerShell 7 or `cmd.exe`

## Bootstrap

```powershell
.\scripts\bootstrap\bootstrap.cmd -CreateVenv -InstallNodePackages
```

The bootstrap script writes diagnostics to `./.diagnostics/latest`.

## Start the local API

```powershell
.\scripts\bootstrap\run-api.cmd
```

The backend root redirects to `/docs`. The supported API namespace is `/api/*`, including:

- `GET /api/health`
- `GET /api/conditions`
- `GET /api/analytics/snapshot`
- `GET /api/connectors`
- `POST /api/connectors/run`

## Start the desktop web workspace

```powershell
npm --workspace apps/desktop run dev
```

The Vite dev server listens on `http://localhost:1420` and proxies `/api` to `http://127.0.0.1:8765`.

## Seed demo data

```powershell
.\scripts\bootstrap\seed-demo.cmd
```

`seed-demo.cmd` is the operator-safe entrypoint for fresh Windows sessions. It waits for `/api/health` before running the connector bundle.

## Start the workstation launcher

```powershell
.\scripts\bootstrap\launch-workstation.cmd
```

This opens the API and desktop dev processes in separate Windows PowerShell sessions with execution policy bypassed for the launched process only.

## Start the Tauri shell

Requires Rust toolchain and Tauri prerequisites.

```powershell
npm --workspace apps/desktop run tauri dev
```
