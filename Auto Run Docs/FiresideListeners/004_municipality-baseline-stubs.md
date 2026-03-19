# 004 Municipality Baseline Stubs

## Goal
Generate one baseline actor stub per municipality minimum from derived workbook seeds.

## Scope
In scope:
- derived municipality seed files
- docs/data-model/*.md

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Read derived municipality seed files.
- [ ] Create baseline actor stub records with provenance.
- [ ] Ensure verification_status remains unconfirmed.
- [ ] Do not create verified actors or platform accounts.
- [ ] Validate counts and parseability.
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
- Each municipality produces a baseline stub.
- All stubs remain unconfirmed and reference-seeded.
- No live platform surfaces are created here.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
