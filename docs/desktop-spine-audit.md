# Open Fireside Desktop Spine Audit (Recovery Mode)

Date: 2026-03-25  
Audit branch: `codex/desktop-spine-audit`  
Baseline commit: `bfa3917` (`main` at audit start)

## Scope

This audit covers the uncommitted desktop/local-DB transition currently present in the working tree and applies a minimal recovery pass to keep renderer surfaces reviewable while preserving desktop boundary work.

## Findings Summary

- No renderer files were physically deleted; most destructive impact came from in-file replacement of large UI surfaces in `src/App.jsx`.
- Dashboard/Maps/Weather/Discourse were flattened into a generic disabled placeholder, reducing reviewability.
- Incidents/Incident Detail/Configure were moved toward local-DB-first operation, which is directionally correct.
- Configure was converted aggressively but is still salvageable as the desktop operations console.
- Desktop boundary, DB spine, and ingestion scaffolding are broadly salvageable and should not be reverted wholesale.

## Material Change Classification

| Area | Files | Classification | Rationale | Action |
|---|---|---|---|---|
| Electron main/preload/runtime boundary | `electron/main/**`, `electron/preload/**`, `package.json` scripts | KEEP | Matches required desktop target and privilege boundary intent. | Keep and harden incrementally. |
| Local DB + Drizzle schema/migrations | `drizzle/**`, `electron/main/db/**` | KEEP | Canonical local SQLite spine is required and already functional. | Keep; continue schema iteration with migrations only. |
| IPC local-data contract expansion | `electron/main/ipc/register.ts`, `src/lib/ipc.js`, `src/types.d.ts` | KEEP | Enables renderer to consume local records and operational status. | Keep; prune only unstable/debug endpoints later if needed. |
| Ingestion/sync + raw-source archival | `electron/main/services/ingest/**`, related repos/services | KEEP | Required for append-only incident history and auditability. | Keep; improve parser quality separately. |
| Vite config migration | `vite.config.js` (deleted), `vite.config.mjs` (added) | KEEP | Format change is acceptable; no functional rollback needed. | Keep replacement; no restore of `.js` file required. |
| Renderer flattening of non-core routes | `src/App.jsx` | RESTORE | Dashboard/Maps/Weather/Discourse were reduced to a near-empty disabled panel, harming review continuity. | Restored visible review panels with truthful disabled states. |
| Route gating behavior | `src/App.jsx` | RESTORE | Disabled routes were non-navigable; prevented review of module shape. | Routes remain visible and openable, but explicitly non-operational. |
| Configure operations conversion | `src/App.jsx` | KEEP | DB path, storage root, sync, and diagnostics align with desktop operations goal. | Keep, but continue UI refinement rather than further flattening. |
| Broad styling rewrite | `src/styles.css` | DEFER | Style changes are acceptable but not yet fully reconciled with legacy shell quality. | Defer visual polishing after audit acceptance. |
| Prior browser/public assumptions | legacy web-centric fetch paths in renderer | REVERT (behavioral) | Renderer live-fetch model conflicts with desktop architecture. | Keep routes, but keep non-operational modules explicitly disabled until local-backed. |

## Recovery Patch Applied

Minimal, reversible UI recovery changes were made:

1. Non-operational module routes (`dashboard`, `maps`, `weather`, `discourse`) remain visible and openable for review.
2. Each route now renders a truthful review panel instead of a single blank disabled shell.
3. Copy explicitly states local-data prerequisites and that live renderer fetching is disabled.
4. Incidents, Incident Detail, and Configure remain local-DB-first and operational.

## Guardrails Going Forward

- Phase 0 cleanup must stay non-destructive.
- Keep module surfaces reviewable even when disabled.
- Do not remove legacy-like structure unless replacement quality is demonstrably better.
- Continue desktop/local-DB transition behind Electron boundary without bulldozing renderer continuity.
