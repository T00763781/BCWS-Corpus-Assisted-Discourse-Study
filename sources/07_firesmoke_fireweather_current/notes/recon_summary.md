# Recon Summary

- source label: FireSmoke Current Fire Weather
- canonical URL: https://firesmoke.ca/forecasts/fireweather/current/
- what the page appears to provide: Leaflet/Mapbox fire weather forecast map with time controls and multiple JS-managed layer groups.
- likely data-bearing endpoint families:
  - Static JSON family under /static/json/, including zone merge data.
  - GeoMet root family referenced in JS for weather layer access.
  - Optional external tile families such as WAQI PM2.5 tiles appear in the layer-controller bundle.
- likely map/layer families:
  - Fire weather raster/time layers managed by local JS bundles.
  - GeoMet-backed weather layer family.
  - Station/location overlays implied by wxstations and grouped layer control bundles.
- specimen status: 4 saved
- auth/cors/anti-automation observations if relevant: Public site. No auth barrier observed. Main page is JS-heavy and likely assembles layer URLs at runtime; bounded recon captured only directly visible families and specimens.
- widget candidate ideas:
  - Fire weather map layer: Page purpose and JS structure strongly suggest time-based fire weather layers.
  - Smoke forecast layer: FireSmoke surface is map-centric but exact smoke layer URLs were not fully expanded in bounded recon.
  - Air quality overlay: WAQI tiles appear in the layer controller bundle as an optional overlay family.
- confidence level: medium
- recommendation: pursue

## specimen files
- specimens\https_firesmoke_ca_forecasts_fireweather_current.html
- specimens\https_firesmoke_ca_static_json_fwf_zone_merge_json.json
- specimens\https_firesmoke_ca_static_js_fwf_layer_controler_0_0_6_min_js.js
- specimens\https_geo_weather_gc_ca_geomet_f_pjson.xml
