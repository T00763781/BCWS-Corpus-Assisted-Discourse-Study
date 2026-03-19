# 009 Osint Doctrine And Evidence Classes

## Goal
Expand the OSINT doctrine and evidence classes used for actor and surface discovery and verification.

## Scope
In scope:
- AGENTS.md
- skills
- taxonomy contracts

Out of scope:
- unrelated milestone files
- local zip bundles
- realtime runtime behavior except where this doc explicitly covers handoff

## Checklist
- [ ] Define OSINT principles including corroboration, stale-source handling, spoof/parody/dormant handling, and negative evidence.
- [ ] Add machine-readable evidence classes if grounded.
- [ ] Define when agents escalate instead of improvising.
- [ ] Validate doctrine references.
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
- Official-source-first is explicit.
- Entity-before-handle is explicit.
- Evidence classes and escalation rules are machine-readable.

## Escalation
Stop and append a blocker if required evidence conflicts, a schema field would need to be invented, or the doc cannot be completed safely from current repo and local inputs.
