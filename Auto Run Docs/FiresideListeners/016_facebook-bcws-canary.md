# 016 Facebook Bcws Canary

## Goal
Prove the Facebook ingestor can normalize BC Wildfire Service content as one actor across text, images, carousels, videos, and comments.

## Scope
In scope:
- BCWS Facebook surface
- content/context contracts

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm BCWS actor binding contract.
- [ ] Require content-shape detection for text, image, carousel, video, and link-share.
- [ ] Require OCR on all image-bearing content and each carousel slide.
- [ ] Require ASR plus sampled-frame OCR on videos.
- [ ] Require comment capture state and completeness recording.
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
- Carousel handling is explicit.
- OCR and ASR expectations are explicit.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
