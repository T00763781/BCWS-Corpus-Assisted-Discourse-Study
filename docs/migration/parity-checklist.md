# Native v2 Parity Checklist

## Global shell

- [x] WPF shell scaffold exists
- [x] collapsible menu state scaffold exists
- [x] `open-sidebar.svg` / `close-sidebar.svg` copied into native assets
- [ ] SVG assets fully rendered/styled to final operator spec
- [ ] Windows tray icon derived from `icon.svg`
- [x] pop-out pages/windows abstraction exists
- [ ] per-surface final multi-window polish

## Dashboard

- [ ] remove archive totals from final dashboard design
- [ ] derived resource deployed counts
- [ ] `heavy.svg` usage
- [ ] `aviation.svg` usage
- [ ] `IMT.svg` usage
- [ ] `personnel.svg` usage
- [ ] `SPU.svg` usage
- [ ] map double-click opens incident in new window
- [ ] full-width responsive layout with less vertical scroll
- [x] pinned incident icon asset requirements recorded
- [ ] pinned incidents use `pinned.svg` / `non-pinned.svg` in final native dashboard

## Incidents

- [x] incidents surface scaffold exists
- [x] incident detail can open as its own workspace/window scaffold
- [ ] archive/local/live truth surfaced natively
- [ ] triage affordances and size columns ported from legacy behavior

## Maps

- [x] tabbed BCWS / CWFIS / ArcGIS sources scaffolded
- [ ] live embedded/native web-map hosting
- [ ] incident-to-map interactions

## Settings / operations

- [x] native runtime/bootstrap state scaffolded
- [x] legacy import doctrine visible in repo docs
- [ ] native capture controls
- [ ] native storage and retention controls

## Persistence

- [x] native SQLite bootstrap scaffolded
- [x] schema draft includes incidents, snapshots, updates, assets, pins, capture runs, app state
- [ ] legacy archive import implemented
- [ ] native capture pipeline implemented
