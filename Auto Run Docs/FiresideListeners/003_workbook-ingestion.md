# 003 Workbook Ingestion

## Goal
Use data-notes-2019.xlsx as a reference seed input to derive machine-readable municipality baseline data.

## Scope
In scope:
- data-notes-2019.xlsx

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Inspect workbook structure locally.
- [ ] Create deterministic import pipeline for municipality-relevant sheets.
- [ ] Emit machine-readable derived seed files.
- [ ] Mark all derived data as reference_seed_2019 and not authoritative current truth.
- [ ] Validate row counts and parseability.
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
- Workbook is treated as reference seed only.
- Derived outputs record provenance.
- Workbook itself is not staged or committed.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
