import { promises as fs } from 'node:fs';

import { loadDotEnv, getConfig } from './lib/config.mjs';
import {
  addMonitoredAccount,
  createDbPool,
  createSyncRun,
  getRecentPostsForRefresh,
  listMonitoredAccounts,
  runSchemaMigration,
  setAccountRunCheckpoint,
  updateSyncRunFailure,
  updateSyncRunSuccess,
  upsertPostCaptureAndResearch
} from './lib/db.mjs';
import {
  collectTargetsForAccount,
  createInstagramSession,
  scrapePostRecord,
  isPostAfterCutoff
} from './lib/instagram_scraper.mjs';

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, '1');
    } else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

async function resolveAccounts(pool, args) {
  const handle = args.get('account');
  if (handle) {
    await addMonitoredAccount(pool, handle);
    return [String(handle).trim().toLowerCase().replace(/^@+/, '')];
  }

  const rows = await listMonitoredAccounts(pool);
  return rows.map((r) => r.handle);
}

function makeSummary() {
  return {
    accounts_total: 0,
    accounts_succeeded: 0,
    posts_discovered: 0,
    posts_targeted: 0,
    posts_skipped_cutoff: 0,
    posts_processed: 0,
    posts_failed: 0,
    errors: []
  };
}

async function run() {
  await loadDotEnv();
  const cfg = getConfig();
  await fs.access(cfg.storageStatePath);

  const args = parseArgs(process.argv.slice(2));
  const triggerMode = args.get('trigger') || 'manual_cli';

  const pool = createDbPool(cfg.databaseUrl);
  await runSchemaMigration(pool);

  const accounts = await resolveAccounts(pool, args);
  if (!accounts.length) {
    throw new Error('No monitored accounts found. Add an account first.');
  }

  const accountScope = args.get('account') ? accounts[0] : 'ALL_ACTIVE';
  const runMeta = await createSyncRun(pool, triggerMode, accountScope);
  const summary = makeSummary();
  summary.accounts_total = accounts.length;

  const session = await createInstagramSession(cfg.storageStatePath, cfg.headless);

  try {
    for (const handle of accounts) {
      try {
        const discovered = await collectTargetsForAccount(session.context, handle, cfg);
        summary.posts_discovered += discovered.size;

        const refreshRows = await getRecentPostsForRefresh(pool, handle, 30);
        const targets = new Map(discovered);
        for (const row of refreshRows) {
          if (row?.post_shortcode && row?.post_url && !targets.has(row.post_shortcode)) {
            targets.set(row.post_shortcode, row.post_url);
          }
        }

        summary.posts_targeted += targets.size;

        for (const [shortcode, postUrl] of targets.entries()) {
          try {
            const scraped = await scrapePostRecord(session.context, postUrl, handle, cfg);
            const candidate = scraped.postRecord;
            candidate.post_shortcode = candidate.post_shortcode || shortcode;

            if (!isPostAfterCutoff(candidate, cfg.ingestCutoffDate)) {
              summary.posts_skipped_cutoff += 1;
              continue;
            }

            await upsertPostCaptureAndResearch(pool, {
              runId: runMeta.run_id,
              parserVersion: cfg.parserVersion,
              accountHandle: handle,
              accountPseudonym: candidate.account_pseudonym,
              postRecord: candidate,
              normalizedComments: scraped.normalizedComments,
              normalizedAccounts: scraped.normalizedAccounts
            });
            summary.posts_processed += 1;
          } catch (err) {
            summary.posts_failed += 1;
            summary.errors.push(`[${handle}:${shortcode}] ${err.message || String(err)}`);
          }
        }

        await setAccountRunCheckpoint(pool, handle, runMeta.run_id);
        summary.accounts_succeeded += 1;
      } catch (err) {
        summary.errors.push(`[${handle}] ${err.message || String(err)}`);
      }
    }

    await updateSyncRunSuccess(pool, runMeta.run_id, summary);

    console.log(JSON.stringify({
      message: 'Sync complete',
      run_id: runMeta.run_id,
      summary
    }, null, 2));
  } catch (err) {
    await updateSyncRunFailure(pool, runMeta.run_id, err.message || String(err), summary);
    throw err;
  } finally {
    await session.close();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exitCode = 1;
});
