# 015 Surface Verification And Registry Admission

## Goal
Decide which candidate surfaces can enter the registry and at what confidence, without letting unverified claims drift in.

## Scope
In scope:
- candidate surface outputs
- verification doctrine

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Inspect candidate outputs and verification doctrine.
- [ ] Resolve duplicate, spoof, parody, and dormant cases where possible.
- [ ] Admit only evidence-backed surfaces into the registry.
- [ ] Record unresolved, deferred, or not_public status explicitly.
- [ ] Validate registry outputs.
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
- Registry admission is explicit.
- Verification levels are evidence-backed.
- Unresolved and not_public states are preserved.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
