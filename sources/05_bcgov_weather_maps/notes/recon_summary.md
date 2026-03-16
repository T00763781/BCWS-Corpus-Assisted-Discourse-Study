# Recon Summary

- source label: BC Government Weather Maps
- canonical URL: https://www2.gov.bc.ca/gov/content/safety/wildfire-status/prepare/weather-fire-danger/fire-weather/weather-maps
- what the page appears to provide: Province of BC content page that links out to a BCWS Weather Stations ArcGIS Web AppBuilder application and other weather-map references.
- likely data-bearing endpoint families:
  - Linked ArcGIS Web AppBuilder item metadata and app data JSON.
  - Linked web map item metadata and operational layer JSON.
  - Operational ArcGIS layer URLs for weather stations, fire zones, and fire centre boundaries surfaced in the linked app data.
- likely map/layer families:
  - Weather stations feature layer at maps.gov.bc.ca.
  - Fire zones feature layer at maps.gov.bc.ca.
  - Fire centre boundaries tiled layer at tiles.arcgis.com.
- specimen status: 5 saved
- auth/cors/anti-automation observations if relevant: Content page is public. Linked ArcGIS item metadata and layer metadata are publicly fetchable without auth.
- widget candidate ideas:
  - Station-location layer: Linked app data exposes a concrete weather stations layer.
  - Fire zone overlay: Linked app data exposes a concrete fire zones layer.
  - Fire centre boundary layer: Linked app data exposes a concrete fire centre boundaries layer.
- confidence level: high
- recommendation: pursue

## specimen files
- specimens\https_www2_gov_bc_ca_gov_content_safety_wildfire_status_prepare_weather_fire_dan.html
- specimens\https_governmentofbc_maps_arcgis_com_sharing_rest_content_items_c36baf74b74a4697.json
- specimens\https_governmentofbc_maps_arcgis_com_sharing_rest_content_items_c36baf74b74a4697.json
- specimens\https_governmentofbc_maps_arcgis_com_sharing_rest_content_items_59b1b3cfd5144059.json
- specimens\https_governmentofbc_maps_arcgis_com_sharing_rest_content_items_59b1b3cfd5144059.json
