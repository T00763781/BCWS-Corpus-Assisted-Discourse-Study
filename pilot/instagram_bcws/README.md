# Instagram BCWS Pilot Extractor

Standalone pilot extractor for three BC Wildfire Service Instagram posts.

## What it does

- Loads Instagram post URLs in Playwright using an authenticated storage state.
- Extracts post metadata, caption, timestamp, and media descriptors.
- Expands comments/replies until no more "load more" controls are found.
- Obfuscates commenter handles with persistent `HMAC-SHA256` pseudonyms.
- Downloads media assets and writes a media manifest per post.
- Writes both raw and normalized JSONL outputs.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy config template:
   - `copy config.example.env .env`
3. Provide values in `.env`.

## Required environment variables

- `IG_SESSION_STATE_PATH`: Playwright storage-state JSON file for an authenticated Instagram session.
- `IDENTITY_HMAC_SECRET`: secret used for persistent handle pseudonymization.

Optional:

- `POST_URLS`: comma-separated URLs; defaults to the three BCWS pilot links.
- `HEADLESS`: `1` (default) or `0`.
- `NAV_MAX_RETRIES`: defaults to `3`.
- `COMMENT_EXPANSION_MAX_STEPS`: defaults to `400`.

## Run

- Capture authenticated session state (interactive browser login):
  - `npm run capture-session`
- `npm start`
- Launch quick review UI:
  - `npm run review-ui`
  - Open `http://localhost:4173/review/`

## Outputs

- `output/raw/posts.jsonl`
- `output/raw/media/`
- `output/raw/run_summary.json`
- `output/normalized/discourse_items.jsonl`
- `output/normalized/accounts.jsonl`

## Notes

- Exported outputs never include cleartext commenter handles.
- Media download excludes profile/avatar image URLs (for example Instagram `-19` path family).
- If media download fails for a specific asset, the run continues and records the failure in `run_summary.json`.
