# Recon Summary

- source label: Environment Canada Weather
- canonical URL: https://weather.gc.ca/
- what the page appears to provide: National Environment Canada weather portal with warnings, forecast navigation, radar/lightning entry points, and SSR-inlined weather state.
- likely data-bearing endpoint families:
  - SSR inline state embedded in the page for alerts, city, and map state.
  - Warnings HTML document family under /warnings/, including weather summaries.
  - Vue SSR bundles that reference lightning, radar, alert, and AQHI state handling.
- likely map/layer families:
  - Lightning family referenced in bundle strings as Lightning/1/ and Lightning/metadata/1.
  - Radar family referenced in bundle strings, including radar composites and coverage metadata.
  - Map state in SSR output suggests route-driven weather web mapping rather than a standalone JSON API.
- specimen status: 4 saved
- auth/cors/anti-automation observations if relevant: Public site. No auth barrier observed. Main page is SSR HTML plus Vue bundles.
- widget candidate ideas:
  - Weather alert summary: Could surface warning summary state if later normalized.
  - Radar availability entry: Bundle points to radar families but host resolution is still uncertain from bounded recon.
  - Lightning entry: Better supported by the explicit lightning route than the generic homepage.
- confidence level: medium
- recommendation: maybe

## specimen files
- specimens\https_weather_gc_ca.html
- specimens\https_weather_gc_ca_vue_ssr_js_main_310e9f420cc9f3c47991_js.js
- specimens\https_weather_gc_ca_vue_ssr_js_chunk_c299a0f6_310e9f420cc9f3c47991_js.js
- specimens\https_weather_gc_ca_warnings_weathersummaries_e_html.html
