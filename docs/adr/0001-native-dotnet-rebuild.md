# ADR 0001: Native .NET Rebuild

## Status

Accepted

## Decision

Open Fireside v2 will be rebuilt as a Windows-native desktop application using:

- .NET 8
- WPF
- MVVM
- native SQLite
- explicit service/repository boundaries

Legacy Electron/sql.js remains a reference implementation and a legacy archive import source. It is not the forward product architecture.

## Why

- The product is Windows-native in practice.
- Local archive handling, binary asset retention, and operator workflows fit native SQLite and native desktop integration better than Electron/sql.js.
- Future requirements such as tray behavior, multi-window workflows, and map/operator surfaces are easier to reason about in a native shell.

## Consequences

- `/dotnet` becomes the primary product path.
- New product work should target native v2 unless a task is explicitly legacy/Electron-specific.
- Legacy archive compatibility must be preserved through an import contract rather than continued Electron-first feature work.

## First-turn foundation scope

- WPF shell scaffold
- MVVM navigation scaffold
- native SQLite bootstrap and schema draft
- legacy import contract definition
- migration/parity docs checked into the repo

## Explicitly deferred

- full capture implementation in native v2
- native tray icon shipping behavior
- full SVG/icon parity on every surface
- complete legacy DB import
- parity claims beyond what is explicitly scaffolded and verified
