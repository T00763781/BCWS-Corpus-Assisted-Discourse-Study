# Open Fireside

Open Fireside is a local-first BC Wildfire archival and verification workspace built with Electron, React, and SQLite.

## Current Scope

- Incident capture archives the published 2025 BCWS incident set into a selected SQLite database.
- Incident detail pages prefer local SQLite data and fall back to live BCWS only when required artifacts are missing.
- Gallery media can be stored as SQLite blobs and rendered locally before any live fallback.
- Settings exposes capture progress, last-run diagnostics, archival completeness, and storage footprint.

## Run

```powershell
npm.cmd install
npm.cmd run dev:desktop
```

To start against a fresh archival database:

```powershell
$env:OF_DB_CREATE_PATH='C:\Users\earl\OneDrive\Documents\open-fireside-incident-archive-2025.sqlite'
npm.cmd run dev:desktop
```

## Archival Modes

### Published-set archival

This is the current working archival mode.

- Source: BCWS `publicPublishedIncident`
- Scope: `fireYear=2025`
- Filters: `stageOfControlList=OUT_CNTRL,HOLDING,UNDR_CNTRL,OUT`
- Behavior: paginates until endpoint exhaustion, then captures detail, attachments, external links, perimeter payloads, response-history extraction, and local media blobs

### Historical completeness status

Open Fireside is currently truthful but endpoint-limited.

- It can prove complete capture of the validated public 2025 published-set query above.
- It does not currently claim full historical-season completeness beyond that upstream public source.
- Phase 4j source investigation did not validate a broader trustworthy and incident-joinable public 2025 source.

See `docs/audits/phase4j-historical-source-expansion.md` for the source-discovery audit.

## Operator Visibility

Settings currently shows:

- active DB path
- live capture progress and current stage
- last completed run diagnostics
- archival completeness counts
- media/storage totals

## Notes

- The incident archival path is the primary maintained workflow.
- G70422 has been used as a recurring verification incident for local detail and local media behavior.
- Weather and discourse remain out of scope for the current archival hardening phases.
