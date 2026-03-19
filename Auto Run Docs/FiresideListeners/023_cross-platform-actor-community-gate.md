# 023 Cross Platform Actor Community Gate

## Goal
Prove cross-platform actor continuity and community/context continuity before scaleout begins.

## Scope
In scope:
- all prior canary outputs

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Review canary outputs together.
- [ ] Validate actor continuity across BCWS and Ravi Parmar surfaces.
- [ ] Validate community continuity across Reddit and Facebook group canaries.
- [ ] Record blockers for any duplicate or ambiguous canonical bindings.
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
- BCWS and Ravi Parmar each remain one canonical actor across their surfaces.
- Communities remain venues.
- No duplicate canonical entities are created by cross-platform comparison.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
