# 021 Reddit Kamloops Canary

## Goal
Prove the Reddit ingestor treats r/Kamloops as a community venue, not as an actor, and preserves thread and reply structure.

## Scope
In scope:
- r/Kamloops

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Confirm community-object handling for r/Kamloops.
- [ ] Require thread root, post author, and nested reply structure.
- [ ] Preserve link/media/text post shape differences.
- [ ] Do not collapse community and participant identities.
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
- The community remains a venue object.
- Posts, comments, and nested replies are preserved.
- Community and poster identity remain distinct.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
