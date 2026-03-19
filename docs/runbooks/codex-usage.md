# Codex Usage

## Purpose
This repository is a controlled-release candidate for a Codex control plane. It is suitable for review, validation, and handoff rehearsal. It is not a production ingest runtime.

## Active control surfaces
- `AGENTS.md` carries repository-wide operating rules.
- `.codex/config.toml` provides repo-local Codex session defaults.
- `.codex/agents/*.toml` defines custom agents using the current Codex custom-agent schema: `name`, `description`, and `developer_instructions`, with optional inherited config keys.

## Important limitations
- The checked-in `skills/` directory is a package asset for this repository's release bundle. Current Codex skill auto-discovery uses `.agents/skills`, so these skills should not be treated as automatically loaded repo skills without an explicit relocation or loader change.
- The scripts in `scripts/` perform deterministic validation and runtime preflight only.
- No script in this repository performs live collection, live account verification, or realtime ingest orchestration.

## Expected workflow
1. Work from a non-`main` branch such as `codex/...`.
2. Run `python scripts/check_control_plane.py .`.
3. Run `python scripts/validate_seed.py .`.
4. Run `pytest`.
5. Record blockers in `docs/runbooks/release-readiness.md` instead of guessing.
