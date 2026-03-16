# Recon Summary

- source label: Environment Canada Lightning Layers
- canonical URL: https://weather.gc.ca/index_e.html?layers=,,lightning
- what the page appears to provide: Environment Canada weather web-mapping route with the lightning layer query active.
- likely data-bearing endpoint families:
  - SSR inline state includes route metadata showing the lightning layer query.
  - Vue chunk strings point to lightning data and metadata families plus radar support families.
  - Warning and alert HTML document families remain present through the same portal shell.
- likely map/layer families:
  - Lightning family referenced as Lightning/1/.
  - Lightning metadata family referenced as Lightning/metadata/1.
  - Radar family strings including radar composites and coverage metadata.
- specimen status: 2 saved
- auth/cors/anti-automation observations if relevant: Public site. No auth barrier observed. Lightning/radar family strings are visible in bundle code, but absolute host/path mapping is not explicit from bounded recon.
- widget candidate ideas:
  - Lightning layer: The most direct candidate from the lightning route bundle.
  - Lightning freshness flag: Bundle references outdated/lightning metadata handling.
  - Radar overlay: Radar support is visible in the same bundle but remains less direct than lightning.
- confidence level: medium
- recommendation: pursue

## specimen files
- specimens\https_weather_gc_ca_index_e_html_layers_lightning.html
- specimens\https_weather_gc_ca_vue_ssr_js_chunk_c299a0f6_310e9f420cc9f3c47991_js.js
