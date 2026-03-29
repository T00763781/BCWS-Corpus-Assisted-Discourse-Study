# Native Rebuild Plan

## Doctrine

Open Fireside v2 is a native Windows rebuild. Electron is legacy/reference only.

The native track must preserve:

- truthful local/live source-state semantics
- endpoint-limited archive completeness claims
- first-class binary asset retention
- operator workflows for incident triage and archive review

## Foundation delivered in Phase 7

- `.NET 8` solution under `/dotnet`
- `WPF` shell scaffold with five core surfaces
- `MVVM` navigation and per-window workspace host
- native SQLite bootstrap with explicit schema draft
- legacy import service contract stub
- migration and parity docs

## Planned build order

1. Native shell foundation
2. Native incident list/detail parity
3. Native archive browsing and asset-open/export flows
4. Legacy DB import validation
5. Native capture/recovery pipeline
6. Native dashboard/maps operator layouts

## Legacy import assumptions to validate

- Legacy archive is a SQLite-compatible file despite sql.js origins.
- `incident_media` can be mapped into native `incident_assets` without losing original binary truth.
- legacy response-history and source-state semantics are trustworthy enough to import without reclassifying records incorrectly.
- legacy pins and capture-run summaries preserve stable `fire_year + incident_number` keys.

## Asset sourcing for native v2

Assets already scaffolded into `dotnet/OpenFireside.Desktop/Assets`:

- `icon.svg`
- `open-sidebar.svg`
- `close-sidebar.svg`
- `pinned.svg`
- `non-pinned.svg`

Assets still required for near-term parity work:

- `heavy.svg`
- `aviation.svg`
- `IMT.svg`
- `personnel.svg`
- `SPU.svg`

These remain source-of-truth inputs for future dashboard/operator surfaces.
