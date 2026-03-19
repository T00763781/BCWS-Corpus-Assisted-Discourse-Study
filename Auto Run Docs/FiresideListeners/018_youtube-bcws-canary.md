# 018 Youtube Bcws Canary

## Goal
Prove the YouTube ingestor can normalize BC Wildfire Service video, transcript, frame OCR, and comment structure.

## Scope
In scope:
- BCWS YouTube surface

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm BCWS YouTube actor binding.
- [ ] Require transcript extraction with confidence.
- [ ] Require sampled-frame OCR and preserved provenance.
- [ ] Require video metadata and comment/reply capture state.
- [ ] Keep transcript, description, and comments separate.
- [ ] Validate outputs and gate conditions.
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
- BCWS remains one canonical actor.
- Video transcript and frame OCR are captured.
- Comments remain separate from transcript text.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
