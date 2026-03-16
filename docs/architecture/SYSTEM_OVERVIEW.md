# System Overview

Open Fireside uses a local-first split architecture:

- **Desktop UI**: Tauri + React + TypeScript
- **Local service**: FastAPI application exposing analyst and connector endpoints
- **Storage**: SQLAlchemy schema with SQLite default and PostgreSQL-ready design
- **Diagnostics**: structured logs, bootstrap logs, environment summary, connector health snapshots
- **Connectors**: environment, GIS, and social adapters writing into a common schema

## Core modules

### services/api
FastAPI application, SQLAlchemy models, connector execution, query services, and analytics.

### packages/config
Strict configuration loading using pydantic settings.

### packages/diagnostics
Diagnostics bundle generation and structured logger setup.

### apps/desktop
Tauri-based Windows workstation with map, feed, actor, claim, and analysis panes.

## Production-grade requirements baked into v1

- idempotent upsert-style connector writes
- typed DTOs and configuration
- explicit error taxonomy for connectors
- diagnostics bundle generation on bootstrap and on demand
- bootstrap and operator documentation first, not last
