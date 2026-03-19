# 008 Deterministic Discovery Scripts

## Goal
Specify deterministic scripts for queue building, URL normalization, and candidate extraction before agent judgment begins.

## Scope
In scope:
- source lane registry
- scripts

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Define deterministic script responsibilities.
- [ ] Add or update machine-readable script routing.
- [ ] Reserve ambiguous tasks for agents or HILT.
- [ ] Validate script-vs-agent split artifacts.
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
- Cheap repetitive work is script-routed.
- Scripts do not perform verification judgment.
- Queues and candidate outputs are machine-readable.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
