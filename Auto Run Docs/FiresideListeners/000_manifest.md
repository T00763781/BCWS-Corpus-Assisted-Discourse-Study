# 000 Manifest

## Goal
Provide the execution index for the FiresideListeners Maestro Auto Run pack.

## Scope
This manifest lists the numbered docs and grouped playbooks only.

## Checklist
- [ ] Confirm the local manifest and package manifest are present.
- [ ] Confirm all 25 numbered docs exist.
- [ ] Confirm the four playbook manifests exist.
- [ ] Confirm embedded skills and agent manifests exist.
- [ ] Confirm validation targets and validator exist.

## Output
- validated package structure

## Gate
Pass only if all referenced docs, playbooks, skills, agents, and validator files exist.

## Escalation
Stop if any numbered doc, playbook, skill, or manifest is missing.
