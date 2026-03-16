# Source Recon Pass 01

## Exact Sources Inspected

1. https://weather.gc.ca/
2. https://wildfiresituation.nrs.gov.bc.ca/dashboard
3. https://wildfiresituation.nrs.gov.bc.ca/map
4. https://wildfiresituation.nrs.gov.bc.ca/list
5. https://www2.gov.bc.ca/gov/content/safety/wildfire-status/prepare/weather-fire-danger/fire-weather/weather-maps
6. https://weather.gc.ca/index_e.html?layers=,,lightning
7. https://firesmoke.ca/forecasts/fireweather/current/
8. https://governmentofbc.maps.arcgis.com/apps/mapviewer/index.html

## Methods Used

- Direct page fetches for HTML and selected JS assets.
- Bundle string inspection for likely data-bearing families and layer references.
- Direct specimen fetches for publicly reachable JSON, ArcGIS layer metadata, and linked ArcGIS item data.
- Headless DOM capture for ArcGIS Map Viewer shell inspection where naked HTML was too thin.
- Per-source runnable recon scripts in each `scripts/` folder to fetch configured specimens and write normalized outputs.

## Per-Source Summary

| source_id | specimens | endpoints | widget candidates | recommendation | summary |
| --- | ---: | ---: | ---: | --- | --- |
| `weather_gc_ca` | 4 | 7 | 3 | maybe | SSR portal with warning summary and bundle-level radar/lightning families; several layer paths remain partially resolved. |
| `bcws_dashboard` | 5 | 9 | 4 | pursue | Shared BCWS Angular shell with direct public ArcGIS layers and unresolved NRS API families referenced in the bundle. |
| `bcws_map` | 5 | 7 | 4 | pursue | Shared BCWS map route with verified public ArcGIS layers and the same unresolved NRS families. |
| `bcws_list` | 3 | 7 | 3 | pursue | Shared BCWS list route with published-incident family references and verified public perimeter layer metadata. |
| `bcgov_weather_maps` | 5 | 9 | 3 | pursue | BC Gov content page linking to a concrete ArcGIS app and web map with identifiable operational layers. |
| `weather_gc_ca_lightning` | 2 | 5 | 3 | pursue | Lightning-focused WeatherGC route with explicit lightning route state and unresolved concrete layer host resolution. |
| `firesmoke_fireweather_current` | 4 | 5 | 3 | pursue | FireSmoke page exposing zone JSON and JS references to GeoMET and air-quality tile families. |
| `bcgov_arcgis_mapviewer` | 2 | 5 | 2 | deprioritize | Generic ArcGIS Map Viewer shell without a concrete map item in the naked URL. |

## Cross-Source Endpoint Family Summary

- `page_document`: 8
- `page_asset`: 9
- `data_endpoint`: 12
- `tile_layer`: 6
- `api_json`: 8
- `arcgis_service`: 10
- `indirect_link`: 1

Observed family patterns:

- The three BCWS routes share one Angular application shell and point to the same mix of unresolved NRS API families plus verified public ArcGIS services.
- The BC Gov weather maps page is mostly a document shell that hands off to ArcGIS sharing item data and concrete operational layers.
- WeatherGC routes expose likely weather, warning, radar, and lightning families primarily through bundle inspection rather than directly obvious JSON endpoints from the landing pages.
- FireSmoke exposes a directly fetchable zone JSON specimen and references external GeoMET and air-quality tile services in client-side JS.
- The generic ArcGIS Map Viewer route is mainly a portal/runtime shell until a specific item is supplied.

## Cross-Source Widget Candidate Summary

- 25 candidate-only widget opportunities were identified across the eight named sources.
- Stronger candidates came from directly verified public ArcGIS layers or fetchable JSON specimens:
  - perimeter layer
  - road safety overlay
  - recreation closures overlay
  - station-location layer
  - fire zone overlay
  - fire centre boundary layer
  - smoke forecast layer
- Weaker candidates came from bundle-string or generic-shell evidence and require further validation before any Configure work:
  - wildfire overview totals
  - situation report summary
  - notification summary
  - lightning freshness flag
  - specific map import entry

## Risks And Caveats

- Several BCWS API hostnames referenced in the public bundle did not resolve from this environment, so those families remain unverified.
- Some WeatherGC lightning and radar references were discoverable only as relative bundle strings, not as directly confirmed service URLs.
- The naked ArcGIS Map Viewer URL did not expose a concrete map item, so findings there remain intentionally limited.
- This pass filtered out analytics, fonts, generic styling bundles, and other infrastructure noise unless needed to explain a data path.

## UI And Implementation Boundary

No widgets were implemented in this pass.
No shell routes, page bodies, or Configure UI content were changed in this pass.
