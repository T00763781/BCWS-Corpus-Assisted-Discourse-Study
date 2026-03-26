# Open Fireside (Desktop Local-First)

Open Fireside targets a **Windows 11 desktop runtime** with a **local SQLite database** as the canonical source of truth.

Architecture baseline:

- official sources -> main-process ingest -> local SQLite -> renderer via IPC
- renderer does not directly fetch BCWS or other official sources
- incident updates are append-only historical rows (newest-first in UI)

## Run

```bash
npm install
npm run dev:desktop
```

## Build

```bash
npm run build
```

## DB + Ingest utilities

```bash
npm run db:migrate
npm run db:seed
```

## Current ingest behavior (Phase 3 baseline)

- `sync.run` performs list/detail ingestion in Electron main process.
- list ingest upserts incident master rows and inserts snapshots when state hash changes.
- detail ingest captures attachments, links, perimeters, evacuation notices, and raw source artifacts.
- ingest runs are logged in `ingest_runs` and raw payload provenance in `raw_source_records`.
- official update insertion is append-only via content hash.
- when API + HTML extraction returns no update text, ingest attempts Playwright fallback extraction using local Chromium/Edge if available.
- ingest configuration is runtime-adjustable in Configure (`detailTargetLimit`, `playwrightFallbackBudget`).

## Added local research tooling

- Incident detail includes latest-two-update diff and dossier export (`json` / `markdown`).
- Configure includes run history, parser diagnostics, and raw source record drilldown.

Default local paths:

- DB: `%LOCALAPPDATA%/OpenFireside/openfireside.db`
- Storage root: `%LOCALAPPDATA%/OpenFireside/storage`

Both can be changed in Configure with copy-then-switch behavior.
