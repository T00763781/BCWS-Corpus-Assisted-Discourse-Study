# Phase 4j Historical Source Expansion

## Summary

Open Fireside currently captures the BCWS published-set archival mode from:

- `https://wildfiresituation.nrs.gov.bc.ca/wfnews-api/publicPublishedIncident`
- explicit archival scope:
  - `fireYear=2025`
  - `stageOfControlList=OUT_CNTRL,HOLDING,UNDR_CNTRL,OUT`
  - `searchText=''`
  - `fireCentreName=''`
  - `orderBy=lastUpdatedTimestamp DESC`
  - paginated until exhaustion

Phase 4j investigated whether BCWS exposes a broader trustworthy 2025 incident universe than that published-set query.

## Sources Inspected

### 1. Published incident list

- `publicPublishedIncident?pageNumber=1&pageRowCount=...`
- with and without `stageOfControlList`
- with `orderBy=lastUpdatedTimestamp DESC`
- with `orderBy=discoveryDate DESC`
- with `fireYear=2025`

Findings:

- `fireYear=2025` is not trustworthy by itself when ordered by `lastUpdatedTimestamp DESC`; the endpoint can still return mixed-year rows and a cross-year `totalRowCount`.
- A broader no-stage sweep ordered by `discoveryDate DESC` was paginated until the first mixed 2025/2024 page.
- That broader sweep still resolved to exactly the same `1386` unique 2025 incident numbers as the current published stage-filtered archival mode.

Conclusion:

- No broader 2025 incident universe was found through `publicPublishedIncident`.
- The current published-set mode is already capturing the full 2025 slice exposed by this public list surface.

### 2. Situation report endpoints

- `wfnews-api/`
- `wfnews-api/publicSituationReport`
- `wfnews-api/situationReport`

Findings:

- API root exposes relation links for:
  - `publishedIncident`
  - `externalUri`
  - `situationReport`
  - `statistics`
- `situationReport` is not publicly accessible (`401 Unauthorized`).
- `publicSituationReport` is publicly accessible and returns `totalRowCount=488`.
- Obvious filters such as `fireYear=2025`, `publishedInd=true`, `archivedInd=true`, and `incidentNumber=G70422` appeared to be ignored on the list endpoint.
- The list payload does not expose a usable incident number, incident GUID, or other clean join key for supplemental incident discovery.

Conclusion:

- `publicSituationReport` is not a trustworthy standalone historical incident discovery source for Open Fireside.
- It may still be useful as future supporting content if BCWS exposes a stable incident join path, but it is not safe to use now for archival completeness claims.

### 3. ArcGIS wildfire services

- `BCWS_ActiveFires_PublicView/FeatureServer/0`
- `BCWS_FirePerimeters_PublicView/FeatureServer/0`
- full ArcGIS service catalog under `services6.arcgis.com/.../rest/services`

Findings:

- `BCWS_ActiveFires_PublicView` exposes wildfire identifiers and `FIRE_YEAR`, but its 2025 count is `1385`, which is slightly smaller than the current published-set capture (`1386`).
- `BCWS_FirePerimeters_PublicView` exposes only perimeter-bearing incidents, with `2025` count `322`, much smaller than the published-set capture.
- No additional public ArcGIS incident layer was found that clearly and trustworthily expands the 2025 incident universe beyond the current published-set capture.

Conclusion:

- ArcGIS public views are useful supporting layers, not a broader historical incident source.

## Decision

No new historical-discovery capture mode was added in Phase 4j.

Reason:

- No broader trustworthy 2025 incident source was validated.
- The best public no-stage incident sweep still collapsed to the exact same `1386` unique 2025 incident numbers as the current published-set archival mode.
- Other candidate sources were either:
  - smaller than the current published-set capture, or
  - not publicly accessible, or
  - not safely joinable back to incidents.

## Exact Blocker

Open Fireside still cannot claim full historical-season completeness beyond the current published 2025 incident set because BCWS does not expose, from the validated public sources inspected here, a broader trustworthy and incident-joinable 2025 list surface than the existing published incident feed.

## Current Truthful Product Position

The existing Phase 4i labeling remains correct:

- Open Fireside captures the full endpoint-exhausted published 2025 incident set for the validated BCWS public query.
- That mode remains `endpoint-limited`.
- It should not be relabeled as full historical-season completeness without a broader validated source.
