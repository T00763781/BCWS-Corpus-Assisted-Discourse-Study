CREATE SCHEMA IF NOT EXISTS control;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS research;

CREATE TABLE IF NOT EXISTS control.monitored_accounts (
  handle TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  last_run_id BIGINT
);

CREATE TABLE IF NOT EXISTS control.sync_runs (
  run_id BIGSERIAL PRIMARY KEY,
  trigger_mode TEXT NOT NULL,
  account_scope TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT
);

CREATE TABLE IF NOT EXISTS raw.post_captures (
  capture_id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES control.sync_runs(run_id) ON DELETE RESTRICT,
  account_handle TEXT NOT NULL,
  post_shortcode TEXT NOT NULL,
  post_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parser_version TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_post_capture_dedupe
  ON raw.post_captures(run_id, post_shortcode, payload_sha256);

CREATE INDEX IF NOT EXISTS idx_raw_post_captures_shortcode
  ON raw.post_captures(post_shortcode, captured_at DESC);

CREATE TABLE IF NOT EXISTS research.posts (
  post_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_handle TEXT NOT NULL,
  account_pseudonym TEXT NOT NULL,
  post_shortcode TEXT NOT NULL UNIQUE,
  external_item_id TEXT,
  post_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  engagement_hint TEXT,
  published_at TIMESTAMPTZ,
  first_collected_at TIMESTAMPTZ NOT NULL,
  last_collected_at TIMESTAMPTZ NOT NULL,
  media_count INTEGER NOT NULL DEFAULT 0,
  latest_payload_sha256 TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_posts_account_published
  ON research.posts(account_handle, published_at DESC);

CREATE TABLE IF NOT EXISTS research.post_media (
  post_id TEXT NOT NULL REFERENCES research.posts(post_id) ON DELETE CASCADE,
  media_index INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  local_path TEXT,
  content_type TEXT,
  byte_size BIGINT,
  sha256 TEXT,
  PRIMARY KEY(post_id, media_index)
);

CREATE TABLE IF NOT EXISTS research.comments (
  discourse_item_id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES research.posts(post_id) ON DELETE CASCADE,
  external_comment_id TEXT,
  actor_pseudonym TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  like_count INTEGER,
  first_collected_at TIMESTAMPTZ NOT NULL,
  last_collected_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_comments_natural
  ON research.comments(post_id, coalesce(external_comment_id, ''), actor_pseudonym, content_sha256);

CREATE INDEX IF NOT EXISTS idx_research_comments_post
  ON research.comments(post_id, published_at DESC);

CREATE TABLE IF NOT EXISTS research.accounts (
  account_pseudonym TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_role TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);
