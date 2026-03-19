# 012 Media Source Lane

## Goal
Run the journalist/media discovery lane against expected actors and media-related slots.

## Scope
In scope:
- media source lane registry
- expected actor stubs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Prepare media source queue.
- [ ] Discover candidate surfaces from official or strongly corroborated media sources.
- [ ] Normalize outlet vs journalist candidates.
- [ ] Record unresolved classification cases.
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
- Media candidates are discovered and normalized.
- Outlet vs journalist ambiguity is preserved for review.
- No fabricated handles are admitted.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
