# 022 Facebook Group Kamloops Hiking Canary

## Goal
Prove the Facebook group ingestor treats Kamloops Hiking as a community venue and preserves participant-authored posts, media, and comments.

## Scope
In scope:
- Kamloops Hiking Facebook group

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm community-object handling for the Facebook group.
- [ ] Require participant-post and community distinction.
- [ ] Require image/video/carousel detection and modality extraction.
- [ ] Preserve comment capture state.
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
- The group remains a community venue.
- Participant posts remain participant-authored.
- Media and comment handling are explicit.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
