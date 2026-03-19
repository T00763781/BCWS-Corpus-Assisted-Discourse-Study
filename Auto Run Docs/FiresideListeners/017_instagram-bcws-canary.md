# 017 Instagram Bcws Canary

## Goal
Prove the Instagram ingestor can normalize BC Wildfire Service image, carousel, and reel content without losing slide order or modality evidence.

## Scope
In scope:
- BCWS Instagram surface

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm BCWS Instagram actor binding.
- [ ] Require image, carousel, and reel content-shape detection.
- [ ] Require OCR per image and per carousel slide.
- [ ] Require ASR and sampled-frame OCR for reels if present.
- [ ] Preserve slide ordering and modality-specific provenance.
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
- Carousel slide order is preserved.
- Native caption, OCR, and ASR stay separate.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
