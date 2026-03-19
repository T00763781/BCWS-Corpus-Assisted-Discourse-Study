# 014 Linktree And Bio Links Lane

## Goal
Resolve bio links, outbound links, and link aggregators as corroboration lanes rather than primary truth lanes.

## Scope
In scope:
- candidate surfaces
- bio-link references

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Prepare queue of bio-link and outbound-link candidates.
- [ ] Resolve targets deterministically where possible.
- [ ] Attach resolved links as corroborating evidence.
- [ ] Escalate mismatches or redirects that change identity assumptions.
- [ ] Validate outputs.
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
- Bio links are used as corroboration, not sole truth.
- Resolved outbound links remain attached to provenance.
- No blind trust in aggregators.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
