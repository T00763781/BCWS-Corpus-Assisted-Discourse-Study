# 024 Bounded Backfill And Dictionaries

## Goal
Build the bounded 2025-2026 wildfire-year corpus and derive dictionaries, fixtures, and test packs from it.

## Scope
In scope:
- validated registry
- canary-proven collectors

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm bounded wildfire-year window.
- [ ] Run bounded backfill against approved surfaces and communities.
- [ ] Derive dictionaries, fixtures, and test packs from observed corpus outputs.
- [ ] Record provenance for derived assets.
- [ ] Validate outputs and artifact counts.
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
- Bounded corpus build uses April 1, 2025 through March 31, 2026.
- Derived dictionaries and fixtures come from corpus evidence.
- No invented runtime assets are admitted.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
