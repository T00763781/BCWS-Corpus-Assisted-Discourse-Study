# 002 Validation And Handoff

## Goal
Stabilize validation, handoff formatting, and append-only phase logging for all later runs.

## Scope
In scope:
- scripts/validate_seed.py
- phases/phase-01-registry-foundation.md

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Inspect current validator and handoff docs.
- [ ] Add missing validation only where grounded.
- [ ] Require phase logging for material changes.
- [ ] Reject silent rewrites of prior PM decisions.
- [ ] Run validation and diff checks.
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
- Validator runs cleanly.
- A-H handoff contract is enforced in docs.
- Append-only phase handling is explicit.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
