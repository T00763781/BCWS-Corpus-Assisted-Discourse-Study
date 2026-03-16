# Widget Object Model Pass

## What Object Model Was Introduced

- widget definitions are now first-class objects in app code with:
  - `widget_id`
  - `label`
  - `source_ids`
  - `status`
  - `render_type`
  - `allowed_pages`
  - `allowed_config_tabs`
  - `fetch_mode`
  - `notes`
- page layout objects are now first-class objects in app code with:
  - `page_id`
  - `route`
  - `edit_mode`
  - `columns`
  - `widget_placements`
- the shared page-builder actions now operate on the same page object shape for Dashboard, Incidents, Discourse, Environment, and Maps

## How Widget Registry Usage Changed

- `sources/00_registry/widget_registry.yaml` now carries widget-object fields instead of simple candidate notes only
- statuses were preserved
- `bcws_perimeter_layer_candidate` remains the only non-`candidate_only` widget
- candidate widgets remain candidate rows only and are not rendered as page widgets

## How The BCWS Perimeter Widget Was Refactored Into A Live Widget Object

- the existing BCWS perimeter implementation is now driven through the widget object model
- it renders through the live widget object path in:
  - `Configure > Sources`
  - `Configure > Widgets`
- it was not promoted to Dashboard, Incidents, Discourse, Environment, or Maps

## What Builder Controls Now Exist On All Pages

Each of Dashboard, Incidents, Discourse, Environment, and Maps now uses the same shared builder surface with:

- edit toggle
- add column
- add widget
- empty column state
- empty widget slot state

## Which Pages Remain Intentionally Blank

- Dashboard
- Incidents
- Discourse
- Environment
- Maps

These remain blank/minimal when edit mode is off and no widget placements exist.

## Promotion Boundary

No widget was promoted to Dashboard, Incidents, Discourse, Environment, or Maps in this pass.

## Exact Verification Steps Run

- `npm run build`
- local shell fetch check at `http://127.0.0.1:4173/`
- browser DOM and screenshot capture for:
  - `#/configure` Sources
  - `#/configure` Widgets
  - `#/dashboard`
  - `#/incidents`
  - `#/discourse`
  - `#/environment`
  - `#/maps`
- browser interaction checks with local Edge automation confirming:
  - Configure top nav rendered `Sources / Widgets / Dashboard / Incidents / Discourse / Environment / Maps`
  - live widget object view rendered in `Configure > Widgets`
  - each page route exposed the same `Edit off / Add column / Add widget` controls
  - edit mode switched on for each page
  - one empty column and one empty widget slot rendered after the shared builder actions
  - no page route rendered the BCWS perimeter widget
