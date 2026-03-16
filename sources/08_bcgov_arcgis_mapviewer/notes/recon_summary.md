# Recon Summary

- source label: Government of BC ArcGIS Map Viewer
- canonical URL: https://governmentofbc.maps.arcgis.com/apps/mapviewer/index.html
- what the page appears to provide: Generic ArcGIS Map Viewer shell without a specific map item in the naked URL.
- likely data-bearing endpoint families:
  - Map Viewer asset bundles, including common and arcgis-core modules.
  - Generic ArcGIS portal item, sharing/rest, and service families implied by the runtime shell.
  - No concrete web map item was exposed directly from the naked shell URL during bounded recon.
- likely map/layer families:
  - Generic ArcGIS service families: FeatureServer, MapServer, ImageServer, VectorTileServer, SceneServer.
  - No concrete operational layer URL was exposed from the naked shell route in bounded recon.
- specimen status: 2 saved
- auth/cors/anti-automation observations if relevant: Public shell route. Main rendered DOM exposes asset bundles only. Concrete map content likely requires a specific item or later user interaction.
- widget candidate ideas:
  - Specific map import entry: Only useful if a later pass supplies a specific ArcGIS item or web map.
  - Generic layer probe entry: Naked mapviewer shell is too generic to support route-level widgets yet.
- confidence level: low
- recommendation: deprioritize

## specimen files
- specimens\https_governmentofbc_maps_arcgis_com_apps_mapviewer_index_html.html
- specimens\https_governmentofbc_maps_arcgis_com_apps_mapviewer_assets_common_gZK4FVHu_js.js
