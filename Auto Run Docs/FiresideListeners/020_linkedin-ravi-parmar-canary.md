# 020 Linkedin Ravi Parmar Canary

## Goal
Prove the LinkedIn ingestor can normalize Ravi Parmar posts, reposts, link shares, media, and comments while preserving public-individual actor identity.

## Scope
In scope:
- Ravi Parmar LinkedIn surface

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm Ravi Parmar LinkedIn actor binding.
- [ ] Require content-shape detection for text, image, video, and link share.
- [ ] Distinguish original authored content from reposts or shares.
- [ ] Preserve modality-specific extraction channels.
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
- Original vs repost/share remains explicit.
- Media and comments are normalized cleanly.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
