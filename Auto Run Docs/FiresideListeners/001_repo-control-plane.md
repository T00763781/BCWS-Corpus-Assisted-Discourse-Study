# 001 Repo Control Plane

## Goal
Freeze repo control plane, PM relay rules, branch safety, and validation before any build work.

## Scope
In scope:
- AGENTS.md
- .codex/config.toml
- .codex/agents/*.toml
- docs/runbooks/codex-usage.md

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Read current repo control files.
- [ ] Confirm custom-agent files use the supported Codex schema.
- [ ] Confirm branch discipline and A-H handoff contract remain explicit.
- [ ] Patch control surfaces only if drift or ambiguity exists.
- [ ] Update validator expectations if grounded in repo contracts.
- [ ] Append blocker instead of guessing when control surfaces conflict.
- [ ] Run validation and record outcome.
- [ ] Commit and push only if validations pass.

## Required Output
- branch name
- files changed
- validations run
- commit SHA
- push result
- blockers
- next recommended PM prompt

## Gate
- Repository control surfaces are explicit.
- Custom-agent files use supported Codex fields only.
- Validation and handoff rules are documented.
- No work on main is allowed.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
