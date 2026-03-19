# 010 Municipal Source Lane

## Goal
Run the municipal directory lane against expected actors without fabricating accounts or handles.

## Scope
In scope:
- municipal source lane registry
- expected actor stubs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Prepare municipal source queue deterministically.
- [ ] Run discovery against expected actor stubs.
- [ ] Normalize candidate surfaces and provenance.
- [ ] Do not promote candidates directly to verified surfaces.
- [ ] Record unresolved cases.
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
- Municipal candidate surfaces are discovered against seeded actors.
- No candidate is auto-verified.
- Conflicts are queued for review.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
