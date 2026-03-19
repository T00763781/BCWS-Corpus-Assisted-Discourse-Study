# platform-canary-qc

## Purpose
Audit platform canary outputs for actor/community continuity, modality extraction, carousel handling, OCR, ASR, and comment/reply structure.

## When to use
Use this skill only when the current Auto Run doc explicitly calls for it.

## Required inputs
- current Auto Run doc
- package contracts relevant to the task
- current repo state

## Required outputs
- machine-readable files or explicit blocker entries
- no invented entities, geography, or file paths

## Validation rules
- touched YAML/JSON/TOML must parse
- validator must pass unless the doc explicitly allows a blocker stop
- unresolved ambiguity must become a blocker entry, not a guessed output

## Anti-hallucination rules
- never invent municipalities, fire zones, live accounts, source inventories, or current authoritative geography
- never promote candidate surfaces directly to verified without evidence
- never stage or commit local reference artifacts unless explicitly instructed

## Escalation rules
Escalate when source evidence conflicts, workbook structure is insufficient, or a schema field would need to be invented.
