# 005 Actor Type Taxonomy And Slotting

## Goal
Define machine-readable actor-group and subtype taxonomy plus slotting rules by geography level.

## Scope
In scope:
- configs/taxonomy/*.yaml
- coverage contract docs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Inspect existing actor-family taxonomy.
- [ ] Add subtype and slotting contracts only where needed.
- [ ] Map geography levels to expected actor groups.
- [ ] Keep unresolved threshold values unset if not grounded.
- [ ] Validate taxonomy files.
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
- Actor groups are explicit.
- Subtypes and geography slotting rules are machine-readable.
- No live entities are invented.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
