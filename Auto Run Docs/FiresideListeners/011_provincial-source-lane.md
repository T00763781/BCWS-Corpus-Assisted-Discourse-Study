# 011 Provincial Source Lane

## Goal
Run the provincial/public institution lane against expected actors and public institutions.

## Scope
In scope:
- provincial source lane registry
- expected actor stubs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Prepare provincial source queue.
- [ ] Discover candidate surfaces.
- [ ] Attach provenance and candidate confidence.
- [ ] Escalate spoof/dormant/duplicate ambiguity.
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
- Provincial candidate surfaces are mapped against expected actors.
- Evidence is recorded.
- Ambiguity is escalated.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
