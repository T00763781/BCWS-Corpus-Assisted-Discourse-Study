CREATE TABLE IF NOT EXISTS incident_attachments (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  source_attachment_id TEXT,
  title TEXT NOT NULL,
  url TEXT,
  local_path TEXT,
  mime_type TEXT,
  observed_at TEXT NOT NULL,
  hash TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS incident_external_links (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  category TEXT,
  label TEXT,
  url TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS incident_perimeters (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  geometry_geojson TEXT NOT NULL,
  geometry_hash TEXT NOT NULL,
  source_ref_id TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS evacuation_notices (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  notice_type TEXT,
  status TEXT,
  event_name TEXT,
  issuing_agency TEXT,
  issued_at TEXT,
  observed_at TEXT NOT NULL,
  source_ref_id TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);
