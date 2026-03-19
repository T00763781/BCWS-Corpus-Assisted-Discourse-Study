# 007 Source Lane Registry

## Goal
Create the machine-readable registry of discovery lanes used later by OSINT mapping.

## Scope
In scope:
- actor stubs
- docs/workflows
- configs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Define source lanes such as municipal directories, provincial directories, media, industry, union, and bio-link lanes.
- [ ] Record lane purpose, expected inputs, and escalation triggers.
- [ ] Keep platform assumptions minimal and explicit.
- [ ] Validate lane registry parseability.
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
- Source lanes are explicit.
- Each lane has deterministic script tasks and agent tasks.
- No source lane claims hidden platform capabilities.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
