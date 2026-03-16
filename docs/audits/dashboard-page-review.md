# Dashboard Page Review

## What changed

- Refactored the dashboard route in [App.tsx](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/apps/desktop/src/App.tsx) so it renders from `fetchDashboardOverview()` and the `/api/dashboard/overview` payload instead of inventing dashboard meaning from generic analytics or condition feeds.
- Reworked the dashboard composition to emphasize:
  - dashboard title and operational overview
  - active wildfire totals
  - stage-of-control summary
  - evacuation summary
  - area restrictions summary
  - pinned incidents
  - fire-centre summary
  - a neutral dashboard map container awaiting live layer wiring
- Adjusted [styles.css](/G:/04_Dev-Tools/01_Tools/01_OpenFireside/apps/desktop/src/styles.css) only where needed to support the narrower dashboard layout and pinned-incident presentation.

## Placeholder or misleading behaviors removed

- Removed dashboard use of analytics-derived `connector_runs` as a primary dashboard metric.
- Removed dashboard-only discourse summary cards.
- Removed dashboard-only fire-centre outlook cards.
- Removed the earlier fabricated dashboard filler that was not part of the `/api/dashboard/overview` contract.
- Confirmed no static `FIRE_CENTRES` list logic remains in the dashboard path.
- Confirmed no hardcoded Prince George count logic remains in the dashboard path.

## Backend fields now driving Dashboard

- `active_incidents`
- `out_of_control`
- `being_held`
- `under_control`
- `evacuation_orders`
- `evacuation_alerts`
- `area_restrictions`
- `fire_centres`
- `pinned_incidents`

## BCWS / mockup sections implemented

- operational dashboard title and overview header
- top-line wildfire totals
- stage-of-control summary
- evacuation and restriction summary
- pinned incidents rail
- fire-centre summary table
- provincial map container panel aligned to the dashboard reference layout, but explicitly marked as awaiting live dashboard layers

## Sections intentionally deferred because real data is not ready

- dashboard news or media sections
- dashboard discourse panels
- environment outlook panels on the dashboard surface
- generic condition-feed tables as a dashboard centerpiece
- live interactive dashboard map layers beyond the container shell

## Exact verification steps run

- `cmd /c .\node_modules\.bin\tsc.cmd -p apps/desktop/tsconfig.json --noEmit`
- `cmd /c npm.cmd --workspace apps/desktop run build`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/health`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/dashboard/overview`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:1420`
- headless Edge DOM capture for `http://127.0.0.1:1420/#/dashboard`
- headless Edge screenshot for `http://127.0.0.1:1420/#/dashboard`
- code search:
  - `rg -n "FIRE_CENTRES|Prince George|connector_runs|discourse_items|Fire centre outlooks|Discourse posture|condition rows|latest condition" apps/desktop/src/App.tsx`
  - `rg -n "active_incidents|evacuation_orders|evacuation_alerts|area_restrictions|fire_centres|pinned_incidents" apps/desktop/src/App.tsx`

## Verification result summary

- backend was reachable at `http://127.0.0.1:8765`
- frontend was reachable at `http://127.0.0.1:1420`
- dashboard loaded without runtime errors
- rendered dashboard values matched `/api/dashboard/overview`
- no static fire-centre list hack remained in the dashboard path
- no hardcoded Prince George summary logic remained in the dashboard path
