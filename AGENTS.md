# FiresideListeners Control-Plane Rules

This repository is a controlled-release candidate for a Codex-operated control plane.

Core rules:
- Never fabricate geography, entities, accounts, or source inventories.
- Treat malformed `.codex` config or custom-agent files as blockers.
- Do not work on `main`; use a task branch such as `codex/...`.
- Run `python scripts/validate_seed.py .` before commit or push when control-plane files change.
- Record blockers instead of guessing when authoritative inputs are missing.

Control-plane surfaces in this repo:
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `docs/runbooks/codex-usage.md`
- `docs/runbooks/release-readiness.md`

Runtime honesty rules:
- The runtime layer in `scripts/` performs preflight and validation only.
- No script in this repository performs live ingest or claims to verify external accounts.
- Production ingest remains blocked until the blockers in `docs/runbooks/release-readiness.md` are resolved from authoritative inputs.
