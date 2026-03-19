# 006 Base 1500 Seed Build

## Goal
Expand municipality baseline plus actor-type slotting into 1,500+ expected actor stubs before OSINT mapping.

## Scope
In scope:
- baseline stubs
- actor-type slotting

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Read baseline stubs and slotting rules.
- [ ] Generate expected actor stubs in batch.
- [ ] Assign geography, actor group, and provenance.
- [ ] Keep verification_status unconfirmed and coverage_status expected.
- [ ] Validate counts by geography and actor group.
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
- 1,500+ expected actor stubs exist or a blocker is logged.
- Records remain expected/unconfirmed.
- No live surfaces are fabricated.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
