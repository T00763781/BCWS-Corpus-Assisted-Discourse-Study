# Shell V2 Reset

- Archived the pre-reset working tree into `99_Archive/pre-shell-v2-reset/` with the reset tag, file inventory, git status snapshot, head snapshot, and moved root items.
- Removed the previous working tree from repo root by moving all legacy root items into the archive and leaving only `.git` and `99_Archive` before unpacking the new baseline.
- Shell V2 is now the repo baseline.
- The named preliminary sources were seeded explicitly in `sources/00_registry/source_registry.yaml`.
- Created these source folders:
  - `sources/01_weather_gc_ca/`
  - `sources/02_bcws_dashboard/`
  - `sources/03_bcws_map/`
  - `sources/04_bcws_list/`
  - `sources/05_bcgov_weather_maps/`
  - `sources/06_weather_gc_ca_lightning/`
  - `sources/07_firesmoke_fireweather_current/`
  - `sources/08_bcgov_arcgis_mapviewer/`
- Created `recon/`, `scripts/`, `specimens/`, `notes/`, and `output/` inside each named source folder.
- No widgets were added in this pass.
- No live data was added in this pass.
