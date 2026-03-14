import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ROOT_DIR, loadDotEnv, getConfig, ensureDir } from './lib/config.mjs';
import { createInstagramSession, scrapePostRecord } from './lib/instagram_scraper.mjs';

const DEFAULT_POST_URLS = [
  'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',
  'https://www.instagram.com/p/DRiTJUfkhtK/',
  'https://www.instagram.com/p/DQp23MFkkIb/'
];

function parseUrls() {
  const raw = process.env.POST_URLS || '';
  if (!raw.trim()) return DEFAULT_POST_URLS;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function appendJsonl(filePath, rows) {
  if (!rows.length) return;
  const payload = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  await fs.writeFile(filePath, payload, 'utf8');
}

async function run() {
  await loadDotEnv();
  const cfg = getConfig();
  await fs.access(cfg.storageStatePath);

  const urls = parseUrls();
  if (!urls.length) {
    throw new Error('No POST_URLS provided and default list is empty.');
  }

  const outputRoot = path.join(ROOT_DIR, 'output');
  const rawDir = path.join(outputRoot, 'raw');
  const normalizedDir = path.join(outputRoot, 'normalized');
  await ensureDir(rawDir);
  await ensureDir(normalizedDir);

  const session = await createInstagramSession(cfg.storageStatePath, cfg.headless);
  const summaries = [];
  const rawPosts = [];

  try {
    for (const postUrl of urls) {
      const summary = {
        post_url: postUrl,
        ok: false,
        post_shortcode: null,
        comment_count: 0,
        media_count: 0,
        media_status: 'EMPTY',
        errors: []
      };

      try {
        const scraped = await scrapePostRecord(session.context, postUrl, 'manual_extract', cfg);
        rawPosts.push(scraped.postRecord);
        summary.ok = true;
        summary.post_shortcode = scraped.postRecord.post_shortcode;
        summary.comment_count = scraped.postRecord.comments.length;
        summary.media_count = scraped.postRecord.media.length;
        summary.media_status = scraped.postRecord.media_summary?.status || 'EMPTY';
      } catch (err) {
        summary.errors.push(err.message || String(err));
      }

      summaries.push(summary);
    }
  } finally {
    await session.close();
  }

  const rawPostsPath = path.join(rawDir, 'posts.jsonl');
  const runSummaryPath = path.join(rawDir, 'run_summary.json');
  await appendJsonl(rawPostsPath, rawPosts);
  await fs.writeFile(runSummaryPath, JSON.stringify({
    started_at: new Date().toISOString(),
    urls,
    per_post: summaries,
    ok_count: summaries.filter((item) => item.ok).length,
    fail_count: summaries.filter((item) => !item.ok).length
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    message: 'Manual extraction finished via authoritative scraper pipeline',
    outputs: {
      raw_posts: 'output/raw/posts.jsonl',
      run_summary: 'output/raw/run_summary.json'
    },
    summary: {
      urls_total: urls.length,
      urls_ok: summaries.filter((item) => item.ok).length,
      urls_failed: summaries.filter((item) => !item.ok).length
    }
  }, null, 2));
}

run().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exitCode = 1;
});
