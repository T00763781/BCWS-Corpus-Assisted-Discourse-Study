# Dashboard and Incidents UX Fix Pass

## Scope

- Global branding consistency check
- Dashboard layout and UX corrections
- Incident list UX corrections
- Incident detail gallery loading behavior

No changes to source families, backend contracts, DB design, or non-dashboard/non-incidents page semantics.

## What changed

- Preserved the dashboard 2x2 composition while expanding the map to fill the available card area.
- Added dashboard source-status chips grounded only in the existing live fetch state:
  - `Stats`
  - `Map`
  - `Evac`
- Tightened the evacuation cards so they sit more cleanly in the right-side stack.
- Reworked the incident list toolbar so `Sort by` is a real dropdown and added a real `Filter` dropdown.
- Changed the stage buttons into direct stage filters:
  - clicking one stage narrows the list to that stage
  - clicking the same stage again restores the full stage set
- Made incident table headers clickable sort toggles.
- Updated the gallery so attachments with unusable live image URLs fail visibly instead of rendering a broken empty image area.

## Branding

- Verified the app is using the canonical [logo.svg](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/public/assets/logo.svg) asset for the visible Open Fireside logo and favicon.
- No alternate logo path is used by the active UI after this pass.

## Dashboard truth preserved

- The live interactive Leaflet map remains in place.
- Dashboard network calls remain limited to the existing approved endpoint families already in the repo.
- `Discourse Signals` remains stubbed.
- `Pinned Incidents` remains stubbed.
- Unsupported resource/category sections remain blank.
- No fake metrics, fake health values, or fabricated dashboard cards were introduced.

## Incident truth preserved

- Incident rows remain tied to the live BCWS incident list.
- Sort and filter behavior are client-side UX controls over the same live dataset.
- No fake summary rows or analytics were added.
- Gallery media is not fabricated. When the current live attachment URL is not publicly usable, the UI now shows a bounded failure state instead of pretending the media exists.

## Files changed in this pass

- [src/App.jsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/App.jsx)
- [src/styles.css](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/src/styles.css)

## Verification run

- `npm install`
- `npm run dev -- --host 127.0.0.1 --port 4173`
- Opened:
  - `#/dashboard`
  - `#/incidents`
  - `#/incidents/2025/C41741`
- Confirmed:
  - canonical `logo.svg` is in use
  - the dashboard map fills its card and still pans/zooms
  - dashboard source chips reflect only real fetch state
  - evacuation cards are visually tighter
  - sort-by is a working dropdown
  - filter dropdown works
  - stage buttons filter the incident list
  - table headers act as sort toggles
  - gallery failures are visible and bounded when the current live image URL is not publicly usable

## Gallery note

During verification, sampled live attachment image URLs from the current BCWS attachment payload returned `401` instead of image bytes for incidents including `C41741`, `C41742`, `K71095`, and `R90700`. The gallery therefore cannot truthfully render those media assets from the current public path. This pass keeps the failure visible rather than fabricating media.
