# Release Readiness

## Control-plane release candidate readiness
Ready for controlled deployment review when all of the following are true:
- `.codex/config.toml` parses cleanly and only uses supported fields.
- `.codex/agents/*.toml` parse cleanly and use the documented custom-agent schema.
- `AGENTS.md`, `docs/runbooks/codex-usage.md`, and the numbered control docs agree on scope and validation rules.
- `python scripts/validate_seed.py .` passes on a non-`main` branch.
- `pytest` passes.
- `sql/control_plane_state.sql` applies cleanly to SQLite.

## Blocked items for production ingest
These remain blockers for production ingest and realtime operations:

- `GEO-001`: authoritative current geography inputs are not checked in. The repo still relies on package assumptions and workbook-derived reference seeds, which are not authoritative current geography.
- `SRC-001`: authoritative source inventory and verified live account inventory are not present. The repository defines source lanes and verification doctrine, but it does not contain resolved, authoritative production sources.

## Current scope statement
- This repo is honest as a control-plane release candidate.
- This repo is not honest as a production ingest system until `GEO-001` and `SRC-001` are resolved from authoritative inputs.
