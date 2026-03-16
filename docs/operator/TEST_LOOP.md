# Newton Test Loop

## Sequence

1. Run bootstrap
2. Start local API
3. Seed demo connectors
4. Start desktop web app or Tauri shell
5. Capture runtime diagnostics
6. Relay repo + diagnostics to Codex for audit

## Commands

```powershell
.\scripts\bootstrap\bootstrap.cmd -CreateVenv -InstallNodePackages
.\scripts\bootstrap\run-api.cmd
.\scripts\bootstrap\seed-demo.cmd
npm --workspace apps/desktop run dev
```

## Expected checkpoints

- `http://127.0.0.1:8765/` redirects to `/docs`
- `http://127.0.0.1:8765/api/health` returns `{"status":"ok","app":"open-fireside-api"}`
- `http://127.0.0.1:8765/api/connectors` returns the connector registry
- `http://127.0.0.1:8765/api/analytics/snapshot` returns counts that increase after connector runs
- `http://localhost:1420` loads without the earlier `Failed to fetch` state
- `.diagnostics/latest/seed-demo.log` records the seeded connector run sequence

## What to note manually

- anything that fails during bootstrap
- connector runs that succeed but feel wrong
- UI surfaces that do not match your BCWS workflow
- missing filters, panes, or map affordances
- anything that feels like a toy instead of a workstation
