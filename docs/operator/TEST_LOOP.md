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
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap\bootstrap.ps1 -CreateVenv -InstallNodePackages
.\scripts\bootstrap\run-api.ps1
.\scripts\bootstrap\seed-demo.ps1
npm --workspace apps/desktop run dev
```

## What to note manually

- anything that fails during bootstrap
- connector runs that succeed but feel wrong
- UI surfaces that do not match your BCWS workflow
- missing filters, panes, or map affordances
- anything that feels like a toy instead of a workstation
