CREATE VIRTUAL TABLE IF NOT EXISTS incident_search_fts USING fts5(
  incident_id UNINDEXED,
  incident_name,
  incident_number,
  latest_update_text
);

CREATE TRIGGER IF NOT EXISTS trg_incidents_ai
AFTER INSERT ON incidents
BEGIN
  INSERT INTO incident_search_fts(incident_id, incident_name, incident_number, latest_update_text)
  VALUES (new.id, new.incident_name, new.incident_number, '');
END;

CREATE TRIGGER IF NOT EXISTS trg_incidents_au
AFTER UPDATE OF incident_name, incident_number ON incidents
BEGIN
  UPDATE incident_search_fts
  SET incident_name = new.incident_name,
      incident_number = new.incident_number
  WHERE incident_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_incidents_ad
AFTER DELETE ON incidents
BEGIN
  DELETE FROM incident_search_fts WHERE incident_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_updates_ai
AFTER INSERT ON incident_updates
BEGIN
  UPDATE incident_search_fts
  SET latest_update_text = new.update_text
  WHERE incident_id = new.incident_id;
END;
