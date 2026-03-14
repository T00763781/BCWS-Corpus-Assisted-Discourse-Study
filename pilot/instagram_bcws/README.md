# Instagram Research Toolkit (BCWS Pilot -> Multi-Account)

Local PostgreSQL-backed toolkit for researcher-triggered Instagram discourse ingestion.

## Capabilities

- Monitor multiple Instagram accounts.
- Add account and run immediate bounded backfill (`published_at >= 2025-04-01`).
- Manual `Check for new posts` sync from UI or CLI.
- Re-fetch comments for the last 30 days of posts during each sync.
- Persist immutable raw captures and normalized research tables in PostgreSQL.
- Serve review UI for accounts, runs, posts, media, and comments.

## Setup

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - `copy config.example.env .env`
3. Fill `.env` values:
   - `IG_SESSION_STATE_PATH`
   - `IDENTITY_HMAC_SECRET`
   - `DATABASE_URL`
4. Capture Instagram login session:
   - `npm run capture-session`
5. Create/update DB schema:
   - `npm run migrate`

## Run

- Start local API + UI:
  - `npm start`
  - Open `http://localhost:4173/review/`

- Manual sync (all active accounts):
  - `npm run sync`

- Manual sync (single account, auto-added if missing):
  - `node src/sync_accounts.mjs --trigger manual_cli --account bcgovfireinfo`

## API Endpoints (local)

- `GET /api/accounts`
- `POST /api/accounts` body: `{ "handle": "bcgovfireinfo", "backfill": true }`
- `DELETE /api/accounts/:handle`
- `POST /api/sync` body: `{ "account": "bcgovfireinfo" }` or `{}` for all
- `GET /api/runs?limit=20`
- `GET /api/posts?account=bcgovfireinfo&limit=150`
- `GET /api/posts/:postId`

## Privacy

- Commenter handles are pseudonymized with stable HMAC pseudonyms.
- Cleartext commenter handles are not written into normalized research tables.
- Secrets/session files should stay local and out of git.
