# Codex Prompt: Open Fireside Comparative Audit

Use this prompt in Codex **after** running the local bootstrap on Newton and after collecting runtime diagnostics.

```text
You are auditing a production-grade internal workstation repo called Open Fireside.

Rules:
- Treat the repo as enterprise production-grade v1, not an MVP, demo, or student tool.
- Do not degrade architecture into toy abstractions.
- Prefer boring, durable, maintainable patterns.
- Preserve local-first Windows 11 operator experience.
- Preserve typed contracts, diagnostics, migration safety, and connector boundaries.

Tasks:
1. Inspect the repository structure and identify architectural weaknesses.
2. Inspect bootstrap output and diagnostics artifacts from `.diagnostics/latest`.
3. Compare the repo against strong patterns for:
   - Tauri desktop app structure
   - FastAPI local service architecture
   - Windows bootstrap and diagnostics workflows
   - multi-source connector SDK design
   - map/analysis workstation UX
4. Fetch external repos only as needed for comparative analysis and implementation ideas.
5. Produce a `feedback.zip` containing:
   - audit-summary.md
   - priority-fixes.md
   - bootstrap-review.md
   - ui-workflow-review.md
   - risk-register.md
   - proposed-patches/ (patch files or replacement files)

Important:
- Ground all findings in the current repo and diagnostics evidence.
- Do not suggest broad rewrites unless there is a concrete production risk.
- Do not introduce cloud-first assumptions.
- Keep the workstation centered on BC wildfire discourse research.
```
