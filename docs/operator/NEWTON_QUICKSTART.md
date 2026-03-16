# Newton Quickstart

## Recommended local layout

- Keep the repo on the internal SSD
- Set `OPEN_FIRESIDE_DATA_DIR` to an external SSD if you expect heavy captures
- Run bootstrap from Windows PowerShell 7

## Bootstrap

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap\bootstrap.ps1 -CreateVenv -InstallNodePackages
```

The bootstrap script writes diagnostics to `./.diagnostics/latest`.

## Start the local API

```powershell
.\scripts\bootstrap\run-api.ps1
```

## Start the desktop web workspace

```powershell
npm --workspace apps/desktop run dev
```

## Start the Tauri shell

Requires Rust toolchain and Tauri prerequisites.

```powershell
npm --workspace apps/desktop run tauri dev
```
