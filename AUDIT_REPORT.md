# Audit Report - Instagram Research Build

- Date: 2026-03-14 (America/Vancouver)
- Repository: BCWS-Corpus-Assisted-Discourse-Study
- Branch: `main`
- Auditor: Codex agent

## Executive Summary
A full audit was performed on the current Instagram ingestion build and local runtime state before push. The BCWS catalogue sync succeeded in prior runs (`run_id=2`), and the DB-backed UI/API stack is operational. A later user-interrupted background run (`run_id=3`) remains marked `RUNNING` in the database and is captured as a known operational issue.

## Scope Audited
- Code/runtime surfaces:
  - Account-based sync pipeline (`sync_accounts.mjs`)
  - Local API/UI server (`serve_research_ui.mjs`, review app)
  - PostgreSQL schema and DB access layer
  - Instagram scraper updates for `/p/` and `/reel/` discovery
- Operational evidence:
  - Syntax checks (`npm run check`)
  - API health/runs endpoints
  - DB counts for BCWS account corpus
- Git content controls for this push:
  - Include code/schema/UI/docs and requested outputs/media
  - Exclude `.env`, `node_modules`, exploratory `audit_*` scripts

## Evidence Collected
1. Build checks
- `npm run check` passed.

2. API state
- `GET /api/health` returned `ok: true`, `sync_running: false`.
- `GET /api/runs?limit=5` shows:
  - `run_id=2` `SUCCEEDED` for `bcgovfireinfo` with summary:
    - `posts_discovered=99`
    - `posts_processed=99`
    - `posts_failed=0`
  - `run_id=3` remains `RUNNING` for `conair.aerial.firefighting` (stale after forced interruption).

3. Database counts (BCWS)
- `research.posts`: 99
- `research.comments`: 620
- `research.post_media`: 353

## Findings
### Passed
- Account-driven ingestion is functioning for BCWS full catalogue.
- UI/API wiring is functional for health and run visibility.
- Scraper discovery now covers both post and reel URL families.
- Persistent pseudonymization path remains in place.

### Known Issues / Risks
- Stale run status handling:
  - Interrupted job left `control.sync_runs.run_id=3` in `RUNNING` state.
  - System currently lacks automatic reconciliation for orphaned/terminated sync processes.
- Media download intermittency:
  - Some Instagram CDN media fetches return transient/denied responses (HTTP 403), already seen during earlier runs.

## Commit Inclusion/Exclusion Policy Applied
Included in commit:
- Core ingestion/API/UI/schema/config-template/documentation changes.
- Requested output/media artifacts currently tracked for the pilot.
- This root report (`AUDIT_REPORT.md`).

Excluded from commit:
- `pilot/instagram_bcws/.env`
- `pilot/instagram_bcws/node_modules/`
- Exploratory scripts: `pilot/instagram_bcws/src/audit_*.mjs`

## Recommended Follow-up (Post-push)
1. Add run watchdog/reconciliation to mark orphaned `RUNNING` rows as `FAILED` with reason.
2. Add explicit media-download failure telemetry by shortcode/media-index into persisted run stats.
3. Consider separating research data artifacts from app repo history if repository size becomes a concern.
