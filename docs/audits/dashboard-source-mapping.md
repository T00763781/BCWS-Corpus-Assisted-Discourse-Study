# Dashboard Source Mapping

## Summary

The current Dashboard is at moderate truthfulness risk because the page now uses a real internal dashboard API contract, but that contract is still aggregating mostly seeded incident and restriction records rather than live external government-source ingests. That means the UI can look operationally credible while still reflecting synthetic or mockup-aligned data, especially for wildfire totals, stage-of-control counts, evacuation counts, area restrictions, pinned incidents, and fire-centre summary.

What is currently real is the internal route and query layer: `fetchDashboardOverview()` calls `/api/dashboard/overview`, and that backend query explicitly computes the visible dashboard counts and lists. What is currently seeded is most of the underlying incident and restriction data used by that query, via `bcws.catalog` seed records and mockup-aligned metadata in the connector layer. What is currently deferred is the provincial map layer wiring and any official-content sections such as highlights or video. What is currently recon-only is the endpoint inventory in `open_fireside_endpoints.csv` and the BCWS connector's `endpoint_candidate` snapshots.

## Source status taxonomy

- `live`: directly harvested from an approved external source family in a current connector run and retained with source reference/citation.
- `normalized`: derived from live approved-source records into internal typed models, with provenance retained.
- `seeded`: authored in repo code or connector seed fixtures and not suitable to present as operational truth.
- `recon-only`: discovered during endpoint reconnaissance and cataloged for engineering use, but not yet integrated into trusted typed ingestion.
- `deferred`: approved source class exists or is expected, but no trustworthy ingestion/render path exists yet.
- `omitted`: should not render on the operator-facing Dashboard because no approved or trustworthy source mapping exists.

## Dashboard layer table

| ui_layer | intended_meaning | current_frontend_component_or_section | current_internal_source | approved_source_class | approved_external_source_family_or_official_url_class | current_status | action_required | render_rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard.title_and_overview` | identify the page as the wildfire operational dashboard and describe what the page represents | `DashboardPage` header in `apps/desktop/src/App.tsx` | static JSX copy | `normalized_internal_derivative` | product-level dashboard framing, with citations attached to the data-bearing sections rather than the title itself | `normalized` | `keep but relabel` | Keep the `Dashboard` title. Keep overview copy neutral and non-operational unless it references cited sections only. |
| `dashboard.active_wildfires` | total currently relevant wildfires in Dashboard scope | top KPI row in `DashboardPage` | `dashboard_overview().active_incidents` from `/api/dashboard/overview` | `normalized_internal_derivative` | BCWS incident/list/detail family: `https://wildfiresituation.nrs.gov.bc.ca/list`, `https://wildfiresituation.nrs.gov.bc.ca/incidents`, and eventual typed BCWS incident ingestion | `seeded` | `keep but re-source` | Render only when derived from live-ingested BCWS incident records; otherwise explicitly mark as seeded/non-live or omit from operator mode. |
| `dashboard.stage_of_control.out_of_control` | count of active incidents currently out of control | top KPI row in `DashboardPage` | `dashboard_overview().out_of_control` | `normalized_internal_derivative` | BCWS incident/list/detail family and incident status fields from official wildfire records | `seeded` | `keep but re-source` | Render only when stage-of-control values come from live BCWS incident ingestion with citations. |
| `dashboard.stage_of_control.being_held` | count of active incidents currently being held | top KPI row in `DashboardPage` | `dashboard_overview().being_held` | `normalized_internal_derivative` | BCWS incident/list/detail family and incident status fields from official wildfire records | `seeded` | `keep but re-source` | Render only when stage-of-control values come from live BCWS incident ingestion with citations. |
| `dashboard.stage_of_control.under_control` | count of active incidents currently under control | top KPI row in `DashboardPage` | `dashboard_overview().under_control` | `normalized_internal_derivative` | BCWS incident/list/detail family and incident status fields from official wildfire records | `seeded` | `keep but re-source` | Render only when stage-of-control values come from live BCWS incident ingestion with citations. |
| `dashboard.evacuation_orders` | count of evacuation orders relevant to tracked wildfire incidents | second KPI row in `DashboardPage` | `dashboard_overview().evacuation_orders` aggregated from `IncidentRestriction` | `normalized_internal_derivative` | BCWS evacuation family: `/services/Evacuation_Orders_and_Alerts/FeatureServer/0` | `seeded` | `keep but re-source` | Render only when counts are derived from live evacuation ingests; otherwise omit from operator mode. |
| `dashboard.evacuation_alerts` | count of evacuation alerts relevant to tracked wildfire incidents | second KPI row in `DashboardPage` | `dashboard_overview().evacuation_alerts` aggregated from `IncidentRestriction` | `normalized_internal_derivative` | BCWS evacuation family: `/services/Evacuation_Orders_and_Alerts/FeatureServer/0` | `seeded` | `keep but re-source` | Render only when counts are derived from live evacuation ingests; otherwise omit from operator mode. |
| `dashboard.area_restrictions` | count of active area restrictions relevant to tracked wildfire incidents | second KPI row in `DashboardPage` | `dashboard_overview().area_restrictions` aggregated from `IncidentRestriction` | `normalized_internal_derivative` | BCWS restrictions family: `/services/British_Columbia_Area_Restrictions_-_View/FeatureServer/13` | `seeded` | `keep but re-source` | Render only when counts are derived from live restriction ingests; otherwise omit from operator mode. |
| `dashboard.provincial_overview_map` | provincial wildfire/evacuation/restriction spatial context | map panel in `DashboardPage` | static neutral container only | `bcws_map_layers` | BCWS map layer families: `/services/BCWS_FirePerimeters_PublicView/FeatureServer/0`, `/services/Evacuation_Orders_and_Alerts/FeatureServer/0`, `/services/British_Columbia_Area_Restrictions_-_View/FeatureServer/13`, and `https://wildfiresituation.nrs.gov.bc.ca/map` | `deferred` | `convert to neutral container only` | Keep only as a neutral container with no implied live overlays until real layer ingestion and citations exist. |
| `dashboard.pinned_incidents` | highest-priority or most-recent incidents surfaced on the dashboard | pinned incidents panel in `DashboardPage` | `dashboard_overview().pinned_incidents` | `normalized_internal_derivative` | BCWS incident/list/detail family: `https://wildfiresituation.nrs.gov.bc.ca/list` and `https://wildfiresituation.nrs.gov.bc.ca/incidents` | `seeded` | `keep but re-source` | Render only when incident rows are live-ingested and each card can cite its BCWS source. |
| `dashboard.fire_centre_summary` | grouped incident summary by fire centre | fire centre summary table in `DashboardPage` | `dashboard_overview().fire_centres` | `normalized_internal_derivative` | BCWS incident/list/detail family, normalized by fire centre from official incident records | `seeded` | `keep but re-source` | Render only when based on live BCWS incident records; include citation callout for the underlying incident set. |
| `dashboard.connector_posture_sidebar` | local operator/test controls for running connectors | `WorkstationLayout` sidebar | static `CONNECTOR_KEYS` and `runConnector()` | `omitted` | none approved for operator-facing dashboard semantics | `normalized` | `move off Dashboard` | Keep out of operator-facing dashboard composition; at most retain in engineering/admin shell only. |
| `dashboard.live_posture_sidebar` | local runtime diagnostics about app health, counts, and connector runs | `WorkstationLayout` sidebar | mixed `dashboard.active_incidents`, `environment.latest_conditions.length`, `analytics.connector_runs` | `omitted` | none approved for operator-facing dashboard semantics | `seeded` | `move off Dashboard` | Keep out of operator-facing dashboard composition; diagnostics must not imply operational truth. |
| `dashboard.resources_assigned` | staffing, equipment, or response resource status at dashboard scope | not currently rendered; only implied by reference and future incident model fields | none on Dashboard | `deferred` | BCWS incident/resource content if official resource fields become available | `deferred` | `omit until real source exists` | Do not render on Dashboard until live source-backed resource fields exist. |
| `dashboard.news_or_highlights` | official BCWS highlights or public operational notices | not currently rendered | none on Dashboard | `bcws_official_channels` | BCWS official content families: `https://wildfiresituation.nrs.gov.bc.ca/dashboard`, `https://blog.gov.bc.ca/bcwildfire/wp-json/wp/v2/...` | `deferred` | `omit until real source exists` | Render only from official BCWS content channels with citation callouts; otherwise omit. |
| `dashboard.video_or_official_channels` | official BCWS public video or channel embeds | not currently rendered | none on Dashboard | `bcws_official_channels` | `https://wildfiresituation.nrs.gov.bc.ca/youtube.jsp` and other BCWS official channel pages | `deferred` | `omit until real source exists` | Render only if sourced from official BCWS channels with explicit provenance; otherwise omit. |

## Relevant recon endpoint families

Using `open_fireside_endpoints.csv` as recon/reference only, the endpoint families most relevant to Dashboard semantics are:

- Incident/catalog/detail/update
  - `https://wildfiresituation.nrs.gov.bc.ca/dashboard`
  - `https://wildfiresituation.nrs.gov.bc.ca/list`
  - `https://wildfiresituation.nrs.gov.bc.ca/incidents`
- Perimeter/map/layer
  - `/services/BCWS_FirePerimeters_PublicView/FeatureServer/0`
  - `https://wildfiresituation.nrs.gov.bc.ca/map`
- Evacuation
  - `/services/Evacuation_Orders_and_Alerts/FeatureServer/0`
- Restrictions
  - `/services/British_Columbia_Area_Restrictions_-_View/FeatureServer/13`
- Official content/highlights
  - `https://blog.gov.bc.ca/bcwildfire/wp-json/wp/v2/...`
  - `https://wildfiresituation.nrs.gov.bc.ca/youtube.jsp`

## False-impression risks

- Seeded incident records are currently aggregated into dashboard counts that look operationally real.
- Seeded incident restrictions are currently presented as evacuation and area-restriction truth without provenance.
- Normalized internal aggregates can be mistaken for live field truth because the page does not currently expose citation callouts.
- The provincial map panel is a neutral container, but if left unlabeled or styled too strongly it can still be interpreted as a live operational map.
- The connector posture sidebar implies operator truth and controllability that belongs to engineering or diagnostics, not the operator dashboard surface.
- The live posture sidebar mixes dashboard counts, analytics counts, and condition counts in a way that can be mistaken for approved dashboard semantics.
- `open_fireside_endpoints.csv` and `endpoint_candidate` records may create a false sense of integration if operators can see them before they are turned into trusted typed ingests.
- Dashboard layer semantics are currently more mature than their source provenance, which is exactly the class of false impression this audit is meant to prevent.

## Recommended next implementation slice

- Dashboard only.
- Keep: `active_wildfires`, all three `stage_of_control` counts, `evacuation_orders`, `evacuation_alerts`, `area_restrictions`, `pinned_incidents`, and `fire_centre_summary`, but only when driven by `normalized_internal_derivative` built from live `bcws_incident`, `bcws_evacuation`, and `bcws_restrictions` ingests with citations.
- Convert to neutral container only: `provincial_overview_map`.
- Move off Dashboard: `connector_posture_sidebar` and `live_posture_sidebar`.
- Omit until real source exists: `resources_assigned`, `news_or_highlights`, and `video_or_official_channels`.
