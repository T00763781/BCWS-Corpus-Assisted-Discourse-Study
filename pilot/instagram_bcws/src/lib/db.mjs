import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

import { ROOT_DIR } from './config.mjs';

export function createDbPool(databaseUrl) {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  return new Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, '') || undefined,
    user: decodeURIComponent(url.username || process.env.PGUSER || 'postgres'),
    password: decodeURIComponent(url.password || process.env.DB_PASSWORD || process.env.PGPASSWORD || ''),
    ssl: sslMode === 'require' ? { rejectUnauthorized: false } : undefined
  });
}

export async function runSchemaMigration(pool) {
  const schemaPath = path.join(ROOT_DIR, 'db', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
}

export async function listMonitoredAccounts(pool) {
  const { rows } = await pool.query(
    `SELECT handle, active, added_at, updated_at, last_checked_at, last_run_id
     FROM control.monitored_accounts
     WHERE active = TRUE
     ORDER BY handle ASC`
  );
  return rows;
}

export async function addMonitoredAccount(pool, handle) {
  const normalized = String(handle || '').trim().toLowerCase().replace(/^@+/, '');
  if (!normalized) throw new Error('Handle is required.');
  const { rows } = await pool.query(
    `INSERT INTO control.monitored_accounts(handle, active)
     VALUES ($1, TRUE)
     ON CONFLICT (handle)
     DO UPDATE SET active = TRUE, updated_at = now()
     RETURNING handle, active, added_at, updated_at, last_checked_at, last_run_id`,
    [normalized]
  );
  return rows[0];
}

export async function deactivateMonitoredAccount(pool, handle) {
  const normalized = String(handle || '').trim().toLowerCase().replace(/^@+/, '');
  const { rows } = await pool.query(
    `UPDATE control.monitored_accounts
     SET active = FALSE, updated_at = now()
     WHERE handle = $1
     RETURNING handle`,
    [normalized]
  );
  return rows[0] || null;
}

export async function createSyncRun(pool, triggerMode, accountScope) {
  const { rows } = await pool.query(
    `INSERT INTO control.sync_runs(trigger_mode, account_scope)
     VALUES ($1, $2)
     RETURNING run_id, started_at, status`,
    [triggerMode, accountScope || null]
  );
  return rows[0];
}

export async function updateSyncRunSuccess(pool, runId, stats) {
  await pool.query(
    `UPDATE control.sync_runs
     SET status = 'SUCCEEDED', completed_at = now(), stats = $2::jsonb
     WHERE run_id = $1`,
    [runId, JSON.stringify(stats || {})]
  );
}

export async function updateSyncRunFailure(pool, runId, errText, stats) {
  await pool.query(
    `UPDATE control.sync_runs
     SET status = 'FAILED', completed_at = now(), error_text = $2, stats = $3::jsonb
     WHERE run_id = $1`,
    [runId, errText || 'Unknown error', JSON.stringify(stats || {})]
  );
}

export async function setAccountRunCheckpoint(pool, handle, runId) {
  await pool.query(
    `UPDATE control.monitored_accounts
     SET last_checked_at = now(), last_run_id = $2, updated_at = now()
     WHERE handle = $1`,
    [handle, runId]
  );
}

export async function getRecentPostsForRefresh(pool, handle, daysBack = 30) {
  const { rows } = await pool.query(
    `SELECT post_shortcode, post_url
     FROM research.posts
     WHERE account_handle = $1
       AND published_at >= (now() - make_interval(days => $2::int))
     ORDER BY published_at DESC`,
    [handle, daysBack]
  );
  return rows;
}

export async function upsertPostCaptureAndResearch(pool, args) {
  const {
    runId,
    parserVersion,
    accountHandle,
    accountPseudonym,
    postRecord,
    normalizedComments,
    normalizedAccounts
  } = args;

  const payload = JSON.stringify(postRecord);
  const payloadSha = createHash('sha256').update(payload).digest('hex');

  await pool.query(
    `INSERT INTO raw.post_captures(run_id, account_handle, post_shortcode, post_url, parser_version, payload_sha256, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (run_id, post_shortcode, payload_sha256) DO NOTHING`,
    [runId, accountHandle, postRecord.post_shortcode, postRecord.post_url, parserVersion, payloadSha, payload]
  );

  const postId = `ig_post_${postRecord.post_shortcode || postRecord.external_item_id || 'unknown'}`;
  const nowIso = postRecord.collected_at || new Date().toISOString();
  await pool.query(
    `INSERT INTO research.posts(
      post_id, platform, account_handle, account_pseudonym, post_shortcode, external_item_id, post_url,
      caption, engagement_hint, published_at, first_collected_at, last_collected_at, media_count, latest_payload_sha256
    ) VALUES (
      $1, 'INSTAGRAM', $2, $3, $4, $5, $6,
      $7, $8, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12, $13
    )
    ON CONFLICT (post_id)
    DO UPDATE SET
      post_url = EXCLUDED.post_url,
      caption = EXCLUDED.caption,
      engagement_hint = EXCLUDED.engagement_hint,
      published_at = COALESCE(EXCLUDED.published_at, research.posts.published_at),
      last_collected_at = EXCLUDED.last_collected_at,
      media_count = EXCLUDED.media_count,
      latest_payload_sha256 = EXCLUDED.latest_payload_sha256`,
    [
      postId,
      accountHandle,
      accountPseudonym,
      postRecord.post_shortcode,
      postRecord.external_item_id,
      postRecord.post_url,
      postRecord.caption || '',
      postRecord.engagement_hint || null,
      postRecord.post_timestamp_iso || null,
      nowIso,
      nowIso,
      Array.isArray(postRecord.media) ? postRecord.media.length : 0,
      payloadSha
    ]
  );

  await pool.query('DELETE FROM research.post_media WHERE post_id = $1', [postId]);

  for (let i = 0; i < (postRecord.media || []).length; i += 1) {
    const m = postRecord.media[i];
    await pool.query(
      `INSERT INTO research.post_media(post_id, media_index, media_type, media_url, local_path, content_type, byte_size, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        postId,
        i + 1,
        m.media_type || 'UNKNOWN',
        m.media_url || '',
        m.local_path || null,
        m.content_type || null,
        Number.isFinite(m.byte_size) ? m.byte_size : null,
        m.sha256 || null
      ]
    );
  }

  for (const account of normalizedAccounts || []) {
    await pool.query(
      `INSERT INTO research.accounts(account_pseudonym, platform, account_role, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
       ON CONFLICT (account_pseudonym)
       DO UPDATE SET
         account_role = EXCLUDED.account_role,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        account.account_pseudonym,
        account.platform,
        account.account_role,
        nowIso,
        nowIso
      ]
    );
  }

  for (const item of normalizedComments || []) {
    const contentSha = createHash('sha256').update(item.content_text || '').digest('hex');
    await pool.query(
      `INSERT INTO research.comments(
        discourse_item_id, post_id, external_comment_id, actor_pseudonym, content_text,
        content_sha256, published_at, like_count, first_collected_at, last_collected_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7::timestamptz, $8, $9::timestamptz, $10::timestamptz
      )
      ON CONFLICT (discourse_item_id)
      DO UPDATE SET
        actor_pseudonym = EXCLUDED.actor_pseudonym,
        content_text = EXCLUDED.content_text,
        content_sha256 = EXCLUDED.content_sha256,
        published_at = COALESCE(EXCLUDED.published_at, research.comments.published_at),
        like_count = EXCLUDED.like_count,
        last_collected_at = EXCLUDED.last_collected_at`,
      [
        item.discourse_item_id,
        postId,
        item.external_item_id,
        item.actor_pseudonym,
        item.content_text || '',
        contentSha,
        item.published_at || null,
        Number.isFinite(item.like_count) ? item.like_count : null,
        nowIso,
        nowIso
      ]
    );
  }

  return { postId, payloadSha };
}

export async function getRuns(pool, limit = 30) {
  const { rows } = await pool.query(
    `SELECT run_id, trigger_mode, account_scope, status, started_at, completed_at, stats, error_text
     FROM control.sync_runs
     ORDER BY run_id DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getPosts(pool, options = {}) {
  const params = [];
  let where = 'WHERE p.platform = \'INSTAGRAM\'';

  if (options.accountHandle) {
    params.push(options.accountHandle);
    where += ` AND p.account_handle = $${params.length}`;
  }

  if (options.sinceIso) {
    params.push(options.sinceIso);
    where += ` AND p.last_collected_at >= $${params.length}::timestamptz`;
  }

  const limit = Math.max(1, Math.min(200, Number(options.limit || 100)));
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT
      p.post_id, p.account_handle, p.post_shortcode, p.post_url, p.caption, p.published_at,
      p.last_collected_at, p.media_count,
      COALESCE(c.comment_count, 0) AS comment_count
    FROM research.posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int AS comment_count
      FROM research.comments
      GROUP BY post_id
    ) c ON c.post_id = p.post_id
    ${where}
    ORDER BY COALESCE(p.published_at, p.last_collected_at) DESC
    LIMIT $${params.length}`,
    params
  );

  return rows;
}

export async function getPostDetail(pool, postId) {
  const postResult = await pool.query(
    `SELECT post_id, account_handle, post_shortcode, post_url, caption, engagement_hint,
            published_at, first_collected_at, last_collected_at, media_count
     FROM research.posts
     WHERE post_id = $1`,
    [postId]
  );

  if (!postResult.rowCount) return null;

  const mediaResult = await pool.query(
    `SELECT media_index, media_type, media_url, local_path, content_type, byte_size, sha256
     FROM research.post_media
     WHERE post_id = $1
     ORDER BY media_index ASC`,
    [postId]
  );

  const commentsResult = await pool.query(
    `SELECT discourse_item_id, external_comment_id, actor_pseudonym, content_text, published_at, like_count, last_collected_at
     FROM research.comments
     WHERE post_id = $1
     ORDER BY published_at ASC NULLS LAST, discourse_item_id ASC`,
    [postId]
  );

  return {
    ...postResult.rows[0],
    media: mediaResult.rows,
    comments: commentsResult.rows
  };
}
