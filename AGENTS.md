# AGENTS.md

## Purpose

This file is the machine-to-machine handoff note for the Open Fireside incident-phase repository.
Use it to preserve working truth, current constraints, and prioritized next steps without relying on user-relayed prompts.

## Current product truth

- Open Fireside is a Windows/Electron desktop incident archive tool under active development.
- A GitHub Pages web build can be used as a public QA / visual-audit surface, but it is not the primary archive runtime.
- The incident pipeline now captures and stores the **published 2025 BCWS incident set** exposed by the validated public query.
- The archive is still **endpoint-limited**. Do **not** claim full 2025 historical-season completeness unless a broader trustworthy upstream source is actually validated.
- The app can now store:
  - incident list rows
  - incident detail records
  - append-only snapshots / raw source artifacts / run summaries
  - external links
  - perimeter payloads
  - response-history entries when extractable
  - local media blobs in SQLite
- Local vs live vs mixed rendering must remain explicit and truthful in the UI.
- Public web QA builds must stay explicit that desktop SQLite selection, capture, and recovery controls are unavailable there.
- Incident pinning is now wired:
  - desktop runtime with an active DB persists pins in SQLite
  - browser QA / no-DB runtime falls back to local browser storage

## Do not regress

- Do not remove or weaken the current incident capture pipeline.
- Do not silently change capture scope claims from endpoint-limited to full-season.
- Do not replace truthful source labels with optimistic UI language.
- Do not add placeholder product surfaces that imply weather, maps, or discourse are wired when they are not.
- Do not introduce broad repo churn unrelated to the current task.

## Verified scope note

As of the latest validated archival investigation:

- `publicPublishedIncident`
- `fireYear=2025`
- stage-filtered published incident query
- paginated to exhaustion
- verified count: **1386 incidents**

A broader trustworthy public BCWS source for full historical 2025 incident completeness was **not** validated.
Keep the product wording aligned with that fact.

## UX / frontend QA findings (completed sweep)

These findings come from the current incident-phase build, the UX survey, and comparison against the supplied mockups.

### Global shell

1. **App icon usage is inconsistent / incorrect**
   - `icon.svg` is not being used consistently as the real application icon.
   - Fix by wiring the intended icon asset into the Electron/app shell and any in-app branding surfaces that still diverge.

2. **Left nav is clipped and not responsive enough**
   - `Dashboard` rides the edge of the available width.
   - Fix by reducing nav label font size slightly, increasing nav width, and making the shell behave more gracefully on resize.

3. **Stage icons are broken**
   - Under Control / Being Held / Out of Control icons render as broken images.
   - Use the actual assets under `/assets` and fix pathing / filename assumptions.

4. **Header treatment is inconsistent across pages**
   - Dashboard has the most complete header pattern.
   - Other major pages should adopt the same top treatment: page title + source status chips + refresh / relevant actions.

5. **The product still feels visually prototype-heavy**
   - It reads as template-first and not yet design-resolved.
   - Prioritize polish and consistency over adding more verbose operator text.

### Dashboard

6. **Remove visible `Fire Year 2025` kicker from the dashboard hero**
   - It adds noise and is not the right top-level emphasis.

7. **Dashboard metric labels need rewriting for clarity**
   - Replace shorthand such as `Active`, `New in 24`, `Out in 24`, `Out in 7` with clearer labels such as:
     - `Active wildfires`
     - `New in 24 hours`
     - `Controlled / out in 24 hours`
     - `Controlled / out in 7 days`
   - Choose final wording deliberately; do not keep cryptic ops shorthand.

8. **Dashboard layout needs polish and better responsiveness**
   - It should resize more gracefully.
   - The current implementation still feels student-project rough.

9. **Pinned incidents are now wired**
   - Dashboard, list, and incident detail now share a real saved pin state.
   - Keep pin persistence truthful: SQLite when an active desktop DB exists, browser local storage fallback otherwise.

10. **Archive totals on dashboard are useful, but visual integration still needs refinement**
   - Keep them, but align them better with the rest of the dashboard design system.

### Incidents list

11. **Add fire size to the list**
   - `sizeHa` exists in the data model and should be surfaced.
   - This is one of the most important missing triage columns.

12. **List still diverges from the mockup in ways that hurt usability**
   - Current table is workable, but not yet aligned to the intended operator view.
   - Reconcile against the mockup instead of drifting farther from it.

13. **Row density is currently sparse but usable**
   - Treat this as an opportunity to add meaningful columns without overcrowding.

14. **List should surface richer incident affordances**
   - Add at-a-glance indicators for things like:
     - media available
     - map download available
     - response-history available
   - SVG/icon set should be chosen intentionally and used consistently.

15. **Table should use available window width better**
   - It should expand more naturally on larger screens.

### Incident detail page

16. **Top summary is mostly usable, but still needs design refinement**
   - Source-state labeling is understandable.
   - Keep the truthfulness, but tighten the visual hierarchy.

17. **Response tab should use the same iconography / language system as the rest of the product**
   - Right now it works functionally, but it is not visually integrated.

18. **Gallery images should be clickable into full view**
   - This is a high-priority interaction improvement.
   - Current gallery scanning works, but full-view interaction is missing.

19. **Gallery local-media behavior is materially working**
   - Do not regress local SQLite-backed image display while improving click/fullscreen behavior.

20. **Map downloads are not being surfaced correctly**
   - G90425 is the reference test case.
   - BCWS shows a downloadable map document for this incident.
   - Open Fireside currently reports no maps associated with the incident.
   - Fix the extraction / classification / surfacing path for downloadable map documents.

21. **Map section can be more useful**
   - Current map presentation is acceptable, but could be larger and more informative.

22. **Discourse tab remains prototype-only**
   - Do not imply it is wired.
   - Keep it visibly future-state or disabled-truthful until real discourse ingestion exists.

### Settings / operations

23. **Settings is too verbose**
   - The current screen exposes useful truth, but the information architecture is noisy and overlong.
   - Introduce subtabs / sections so the operator can parse it quickly.

24. **Operator wording needs cleanup**
   - The difference between `Capture incidents` and `Recover response history` is not intuitive enough.
   - Clarify each control in plain language.

25. **Progress visibility is directionally good**
   - Keep the live run state / progress work.
   - Do not regress operator visibility while simplifying the screen.

26. **Long-term pipeline settings need room to grow**
   - If incidents already require this much operational detail, weather and discourse will need their own sub-tabs or pipeline sections.

### Weather / Maps / Discourse surfaces

27. **Weather and Maps should be prototyped outside this repo before integration**
   - Do not force them into the incident repo prematurely.
   - Use the supplied external references / mockups as design and source planning inputs.

28. **Maps route is currently blank and should not pretend otherwise**
   - If kept visible, it must use the same header language and a truthful not-wired / prototype state until implemented.

## Backend / archival QA findings (completed review)

### Verified

- Current code and investigation support the claim that the app captures the paginated, published, stage-filtered 2025 BCWS incident set.
- The product is correctly kept endpoint-limited rather than overclaiming historical completeness.
- Incident detail pages distinguish local DB capture vs live fallback vs mixed source states.
- Local media storage in SQLite is materially working.
- G70422 remains a valid hard-case incident for ongoing regression checks.

### Concerns still worth carrying forward

1. **Terminology and operator understanding**
   - Technical truth is present, but the operator screen is harder to parse than it should be.

2. **Storage tradeoff visibility matters**
   - SQLite media storage is working, but DB size growth is substantial.
   - Keep showing size / totals / media counts.

3. **Map-download completeness still needs work**
   - This is now both a frontend and backend fidelity issue.
   - Treat map downloads as first-class archival artifacts where possible.

4. **Do not infer completeness from UI**
   - Continue checking code path, DB state, and endpoint behavior when validating future claims.

## Reference incidents for QA

Always use these as regression anchors unless the task explicitly says otherwise:

- **G70422** — hard-case incident; response history + media + detail fidelity
- **G90425** — map download / document surfacing test
- **K60922** — image-heavy incident for gallery / local media behavior

## Mockup / source references for future weather and maps work

User-supplied references:

- BC Gov ArcGIS wildfire map app: `https://governmentofbc.maps.arcgis.com/apps/webappviewer/index.html?id=7c6b5180663f443ba0115114264b0620`
- BC fire weather maps: `https://www2.gov.bc.ca/gov/content/safety/wildfire-status/prepare/weather-fire-danger/fire-weather/weather-maps`
- CWFIS interactive map: `https://cwfis.cfs.nrcan.gc.ca/interactive-map`
- BCWS map: `https://wildfiresituation.nrs.gov.bc.ca/map`

Use these for external prototyping / planning, not as permission to overstate what is wired in the current repo.

## Next recommended build order

1. **Global shell cleanup**
   - fix icon usage
   - fix nav clipping
   - fix stage icon assets
   - standardize page headers

2. **Incidents list refinement**
   - add fire size
   - align layout more closely to mockup
   - add incident affordance icons (media / maps / response)
   - improve responsive width use

3. **Incident page interaction improvements**
   - clickable gallery / full-view images
   - improve response visual structure without losing truth labels

4. **Map-download archival + surfacing**
   - make downloadable map docs appear correctly for incidents like G90425

5. **Settings IA cleanup**
   - reduce verbosity
   - add subtabs / sections
   - clarify action labels

6. **Only after that:** weather / maps / discourse integration planning

## Working style for future agents

- Prefer narrow, auditable turns.
- Keep report-backs precise about what changed, what was verified, and what remains deferred.
- When the UI and mockups disagree, reconcile consciously; do not drift.
- Use real assets from `/assets` instead of placeholders or broken paths.
- Preserve the archive pipeline first; polish second; expand scope third.
