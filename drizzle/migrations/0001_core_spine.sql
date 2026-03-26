CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  bcws_incident_guid TEXT UNIQUE,
  fire_year INTEGER NOT NULL,
  incident_number TEXT NOT NULL,
  incident_name TEXT NOT NULL,
  fire_centre TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(fire_year, incident_number)
);

CREATE TABLE IF NOT EXISTS incident_snapshots (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_updated_at TEXT,
  stage_of_control TEXT,
  size_ha INTEGER,
  discovery_date TEXT,
  cause_text TEXT,
  resources_json TEXT,
  location_json TEXT,
  hash TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  published_at TEXT,
  observed_at TEXT NOT NULL,
  update_text TEXT NOT NULL,
  update_hash TEXT NOT NULL,
  source_ref_id TEXT,
  UNIQUE(incident_id, update_hash),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS raw_source_records (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  incident_id TEXT,
  fetch_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT,
  content_hash TEXT,
  storage_rel_path TEXT,
  parser_version TEXT,
  parse_status TEXT,
  parse_error TEXT
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT,
  error_json TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
