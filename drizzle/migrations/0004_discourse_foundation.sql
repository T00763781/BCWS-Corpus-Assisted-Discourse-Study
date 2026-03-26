CREATE TABLE IF NOT EXISTS discourse_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  title TEXT,
  body_text TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS discourse_item_comments (
  id TEXT PRIMARY KEY,
  discourse_item_id TEXT NOT NULL,
  source_comment_id TEXT NOT NULL,
  body_text TEXT,
  published_at TEXT,
  FOREIGN KEY (discourse_item_id) REFERENCES discourse_items(id)
);

CREATE TABLE IF NOT EXISTS incident_discourse_links (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  discourse_item_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (discourse_item_id) REFERENCES discourse_items(id)
);

CREATE TABLE IF NOT EXISTS update_discourse_links (
  id TEXT PRIMARY KEY,
  incident_update_id TEXT NOT NULL,
  discourse_item_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_update_id) REFERENCES incident_updates(id),
  FOREIGN KEY (discourse_item_id) REFERENCES discourse_items(id)
);
