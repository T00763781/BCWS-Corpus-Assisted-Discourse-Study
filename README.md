# FiresideListeners Maestro Auto Run Pack

This repository is a reviewable release candidate for the FiresideListeners Codex control plane. It rebuilds milestones 001 through 025 as Auto Run docs, grouped playbooks, embedded package assets, and machine-readable validation contracts for control-plane hardening only.

Purpose:
- hand off a controlled-release Codex control pack that reduces drift
- keep the repo canonical while giving Maestro explicit numbered execution docs
- separate agent judgment from deterministic scripts to save token cost
- support build/backfill planning and runtime handoff preflight only; realtime runtime is explicitly non-swarm

Package highlights:
- 25 numbered Auto Run docs
- 4 grouped playbook manifests
- embedded skills and agent manifests
- repo-local Codex control-plane config and custom agents
- machine-readable contracts, acceptance gates, and runtime preflight schema
- gold and minimum examples
- deterministic validation and pytest coverage

Operational assumptions:
- official wildfire-year build corpus window: April 1, 2025 through March 31, 2026
- swarm is used to build FiresideListeners and collect/test against the wildfire-year corpus
- May 1, 2026 remains a planning target only and does not imply production ingest readiness
- `data-notes-2019.xlsx` is a local reference seed, not authoritative current truth

Production-ingest blockers:
- `GEO-001`: authoritative current geography inputs are not present in this repository
- `SRC-001`: authoritative source inventory and verified live account inventory are not present in this repository

Fail-closed posture:
- without authoritative geography inputs, production ingest is not ready
- without authoritative source inventory and verified account inventory, production ingest is not ready
