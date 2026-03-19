# 019 Tiktok Ravi Parmar Canary

## Goal
Prove the TikTok ingestor can normalize Ravi Parmar as a public-individual actor with short-form video, captions, overlays, and comments.

## Scope
In scope:
- Ravi Parmar TikTok surface

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm Ravi Parmar actor binding.
- [ ] Require short-form video capture, transcript extraction, overlay OCR, and caption capture.
- [ ] Preserve hashtags and comment capture state.
- [ ] Do not collapse actor identity across unrelated surfaces.
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
- Ravi Parmar remains one canonical actor.
- Video-first ingestion works.
- Caption, ASR, and OCR are preserved separately.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
