# 013 Industry Union Source Lane

## Goal
Run industry and union discovery lanes against expected business and labour actor slots.

## Scope
In scope:
- industry/union source lanes
- expected actor stubs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Prepare industry and union queues.
- [ ] Discover candidate surfaces from directory and official source lanes.
- [ ] Normalize candidate type and provenance.
- [ ] Escalate ambiguous entity matches.
- [ ] Validate outputs.
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
- Industry and union candidates are discovered against seeded slots.
- Subtype alignment remains explicit.
- No candidate is auto-promoted.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
