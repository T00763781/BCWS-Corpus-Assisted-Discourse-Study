CREATE TABLE IF NOT EXISTS release_blockers (
    blocker_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
    authoritative_input_required INTEGER NOT NULL CHECK (authoritative_input_required IN (0, 1))
);

CREATE TABLE IF NOT EXISTS validation_runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
    recorded_at_utc TEXT NOT NULL
);
