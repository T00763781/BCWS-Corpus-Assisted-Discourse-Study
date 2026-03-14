import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toPseudonym } from './hash_identity.mjs';
import { normalizePosts } from './normalize_output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_RAW_DIR = path.join(ROOT_DIR, 'output', 'raw');
const OUTPUT_MEDIA_DIR = path.join(OUTPUT_RAW_DIR, 'media');
const OUTPUT_NORM_DIR = path.join(ROOT_DIR, 'output', 'normalized');

const DEFAULT_POST_URLS = [
  'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',
  'https://www.instagram.com/p/DRiTJUfkhtK/',
  'https://www.instagram.com/p/DQp23MFkkIb/'
];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDotEnv(dotEnvPath) {
  try {
    const raw = await fs.readFile(dotEnvPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

function parseUrls() {
  const raw = process.env.POST_URLS || '';
  if (!raw.trim()) return DEFAULT_POST_URLS;
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function resolveMaybeRelativePath(maybePath) {
  if (!maybePath) return null;
  if (path.isAbsolute(maybePath)) return maybePath;
  return path.resolve(ROOT_DIR, maybePath);
}

async function withRetries(fn, retries, label) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < retries) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      const waitMs = attempt * 1500;
      console.warn(`[retry] ${label} failed on attempt ${attempt}/${retries}: ${err.message}. Retrying in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

function extractShortcodeFromUrl(url) {
  const m = String(url).match(/\/p\/([^/?#]+)/i);
  return m ? m[1] : null;
}

async function navigateToPost(page, url, retries) {
  await withRetries(
    async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      const hasContentRoot = await page.locator('main, article, [role=\"main\"]').count();
      if (!hasContentRoot) {
        throw new Error('Instagram content root not found after navigation');
      }
    },
    retries,
    `navigate:${url}`
  );
}

async function expandCaptionIfCollapsed(page) {
  for (let i = 0; i < 5; i += 1) {
    const clicked = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      for (const node of nodes) {
        const txt = (node.textContent || '').trim();
        if (/^more$/i.test(txt) || /see more/i.test(txt) || /more$/i.test(txt)) {
          node.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) return;
    await page.waitForTimeout(500);
  }
}

async function expandAllCommentsAndReplies(page, maxSteps) {
  const patternSources = [
    'view all\\s+\\d+\\s+comments',
    'view all comments',
    'load more comments',
    'see more comments',
    'view replies',
    'load more replies',
    'see more replies',
    'more comments',
    'more replies'
  ];

  let idleRounds = 0;
  for (let step = 0; step < maxSteps; step += 1) {
    const clickedText = await page.evaluate((patterns) => {
      const regexes = patterns.map((source) => new RegExp(source, 'i'));
      const controls = Array.from(document.querySelectorAll('button, a, div[role="button"]'));

      for (const control of controls) {
        const txt = (control.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt) continue;
        if (regexes.some((rx) => rx.test(txt))) {
          control.click();
          return txt;
        }
      }
      return null;
    }, patternSources);

    if (clickedText) {
      idleRounds = 0;
      await page.waitForTimeout(750);
      continue;
    }

    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(650);
    idleRounds += 1;

    if (idleRounds >= 4) {
      break;
    }
  }
}

async function collectMediaAcrossCarousel(page, postUrl, shortcode, retries) {
  const media = [];
  const seenUrls = new Set();

  function canonicalMediaKey(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return `${u.origin}${u.pathname}`;
    } catch {
      return rawUrl;
    }
  }

  async function extractMp4FromHtml(html) {
    const normalized = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    const matches = normalized.match(/https:\/\/[^"']+?\.mp4[^"']*/g) || [];
    const unique = Array.from(new Set(matches.filter((u) => /^https?:\/\//i.test(u))));
    return unique[0] || null;
  }

  function isLikelyPostMediaUrl(url, mediaType, expectedShortcode) {
    if (!url) return false;
    if (url.startsWith('blob:')) return false;
    if (mediaType === 'VIDEO') return /^https?:\/\//i.test(url);
    if (!/^https?:\/\//i.test(url)) return false;
    // Instagram post media commonly uses *-15 path family, while avatars are often *-19.
    if (url.includes('/t51.') && url.includes('-19/')) return false;
    if (expectedShortcode && !url.includes(expectedShortcode) && url.includes('/t51.2885-19/')) return false;
    if (url.includes('/t51.') && url.includes('-15/')) return true;
    return mediaType === 'VIDEO';
  }

  async function detectExpectedSlideCount() {
    const count = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('main span, main div, article span, article div'));
      for (const node of nodes) {
        const t = (node.textContent || '').trim();
        const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) {
          const total = Number(m[2]);
          if (Number.isFinite(total) && total > 1 && total <= 30) return total;
        }
      }
      return null;
    });
    return count || null;
  }

  async function detectSlidePosition() {
    const pos = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('main span, main div, article span, article div'));
      for (const node of nodes) {
        const t = (node.textContent || '').trim();
        const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) {
          const current = Number(m[1]);
          const total = Number(m[2]);
          if (Number.isFinite(current) && Number.isFinite(total) && total > 1) {
            return { current, total };
          }
        }
      }
      return null;
    });
    return pos;
  }

  async function readVisibleMediaCandidates() {
    const items = await page.evaluate(() => {
      const ogVideo = document.querySelector('meta[property="og:video"]')?.getAttribute('content')
        || document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content')
        || null;
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

      const candidates = [];

      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.currentSrc || img.getAttribute('src');
        if (!src || src.startsWith('data:')) continue;
        const rect = img.getBoundingClientRect();
        const area = Math.max(0, rect.width * rect.height);
        if (area < 30000) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        candidates.push({
          media_type: 'IMAGE',
          media_url: src,
          width: img.naturalWidth || null,
          height: img.naturalHeight || null,
          alt_text: img.getAttribute('alt') || null,
          area
        });
      }

      const videos = Array.from(document.querySelectorAll('video'));
      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        const area = Math.max(0, rect.width * rect.height);
        if (area < 30000) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const src = video.currentSrc || video.getAttribute('src') || null;
        const poster = video.getAttribute('poster') || ogImage || null;
        candidates.push({
          media_type: src && !src.startsWith('blob:') ? 'VIDEO' : 'VIDEO_POSTER_ONLY',
          media_url: (src && !src.startsWith('blob:')) ? src : (ogVideo || poster),
          poster_url: poster,
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          area
        });
      }

      candidates.sort((a, b) => b.area - a.area);
      return candidates.slice(0, 3);
    });
    return items || [];
  }

  function mediaIdToken(url) {
    try {
      const base = new URL(url).pathname.split('/').pop() || '';
      const m = base.match(/_(\d{8,})_/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  async function clickNextControl() {
    return await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      const next = candidates.find((n) => {
        const aria = (n.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('next')) return true;
        const txt = (n.textContent || '').trim().toLowerCase();
        return txt === 'next';
      });
      if (!next) return false;
      const rect = next.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      next.click();
      return true;
    });
  }

  async function hasNextControl() {
    return await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      const next = candidates.find((n) => {
        const aria = (n.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('next')) return true;
        const txt = (n.textContent || '').trim().toLowerCase();
        return txt === 'next';
      });
      if (!next) return false;
      const rect = next.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  async function advanceToNextDistinctSlide(previousMediaKey) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const movedNext = await clickNextControl();
      if (!movedNext) return false;

      await page.waitForTimeout(450);

      try {
        await page.waitForFunction((prevKey) => {
          const candidates = [];
          const images = Array.from(document.querySelectorAll('img'));
          for (const img of images) {
            const src = img.currentSrc || img.getAttribute('src');
            if (!src || src.startsWith('data:')) continue;
            const rect = img.getBoundingClientRect();
            const area = Math.max(0, rect.width * rect.height);
            if (area < 30000) continue;
            if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
            candidates.push({ src, area });
          }
          candidates.sort((a, b) => b.area - a.area);
          const top = candidates[0]?.src || null;
          if (!top) return false;
          try {
            const u = new URL(top);
            const key = u.origin + u.pathname;
            return key !== prevKey;
          } catch {
            return top !== prevKey;
          }
        }, previousMediaKey, { timeout: 2500 });
        return true;
      } catch {
        // try another next click
      }
    }
    return false;
  }

  async function probeMissingByIndex(expectedCount) {
    for (let i = 1; i <= expectedCount; i += 1) {
      const target = new URL(postUrl);
      target.searchParams.set('img_index', String(i));
      try {
        await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(600);
      } catch {
        continue;
      }
      const item = await page.evaluate(() => {
        const ogVideo = document.querySelector('meta[property="og:video"]')?.getAttribute('content')
          || document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content')
          || null;
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
        if (ogVideo) return { media_type: 'VIDEO', media_url: ogVideo, poster_url: ogImage };
        if (ogImage) return { media_type: 'IMAGE', media_url: ogImage };
        return null;
      });
      if (!item || !item.media_url || !isLikelyPostMediaUrl(item.media_url, item.media_type, shortcode)) continue;
      const key = canonicalMediaKey(item.media_url);
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      media.push(item);
    }
  }

  const expectedSlides = await detectExpectedSlideCount();
  const carouselMode = await hasNextControl();
  const maxIterations = expectedSlides ? Math.max(8, expectedSlides * 2) : 24;
  let anchorPrefix = null;
  for (let idx = 0; idx < maxIterations; idx += 1) {
    const visibleItems = await readVisibleMediaCandidates();
    const candidates = carouselMode ? visibleItems : (visibleItems.length ? [visibleItems[0]] : []);
    for (const item of candidates) {
      if (!item || !item.media_url) continue;
      if (!isLikelyPostMediaUrl(item.media_url, item.media_type, shortcode)) continue;
      if (item.media_type === 'IMAGE') {
        const token = mediaIdToken(item.media_url);
        if (!anchorPrefix && token) {
          anchorPrefix = token.slice(0, 7);
        } else if (anchorPrefix && token && !token.startsWith(anchorPrefix)) {
          continue;
        }
      }
      const mediaKey = canonicalMediaKey(item.media_url);
      if (seenUrls.has(mediaKey)) continue;
      seenUrls.add(mediaKey);
      media.push(item);
    }

    if (expectedSlides && media.length >= expectedSlides) break;
    if (!carouselMode) break;
    const prevKey = visibleItems[0]?.media_url ? canonicalMediaKey(visibleItems[0].media_url) : null;
    const advanced = await advanceToNextDistinctSlide(prevKey);
    if (!advanced) break;
  }

  if (expectedSlides && media.length < expectedSlides) {
    await probeMissingByIndex(expectedSlides);
  }

  const hasVideo = media.some((m) => m.media_type === 'VIDEO');
  const posterOnlyIndex = media.findIndex((m) => m.media_type === 'VIDEO_POSTER_ONLY');
  if (!hasVideo && posterOnlyIndex >= 0) {
    let fallbackMp4 = await extractMp4FromHtml(await page.content());
    if (!fallbackMp4) {
      const probe = await page.context().newPage();
      try {
        await probe.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await probe.waitForTimeout(5000);
        fallbackMp4 = await extractMp4FromHtml(await probe.content());
      } catch {
        // ignore probe failures
      } finally {
        await probe.close();
      }
    }

    if (fallbackMp4) {
      media[posterOnlyIndex] = {
        ...media[posterOnlyIndex],
        media_type: 'VIDEO',
        media_url: fallbackMp4
      };
    }
  }

  return media;
}

async function collectPostAndCommentData(page, postUrl, identitySecret) {
  const shortcodeFromUrl = extractShortcodeFromUrl(postUrl);

  const extracted = await page.evaluate((shortcode) => {
    const metaMap = Object.fromEntries(
      Array.from(document.querySelectorAll('meta[property],meta[name]')).map((m) => [
        m.getAttribute('property') || m.getAttribute('name'),
        m.getAttribute('content') || ''
      ])
    );

    const ldJsonObjects = [];
    for (const node of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      const txt = (node.textContent || '').trim();
      if (!txt) continue;
      try {
        ldJsonObjects.push(JSON.parse(txt));
      } catch {
        // ignore parse failures
      }
    }

    const contentRoot = document.querySelector('main, article, [role=\"main\"]') || document;
    const timeNode = contentRoot.querySelector('time[datetime]') || document.querySelector('time[datetime]');
    const timestampIso = timeNode ? timeNode.getAttribute('datetime') : null;

    let caption = '';
    if (metaMap['og:description']) {
      const og = metaMap['og:description'];
      const m = og.match(/on Instagram:\s*["“]([\s\S]+)["”]\s*$/i);
      if (m && m[1]) {
        caption = m[1].trim();
      } else if (/on Instagram:/i.test(og)) {
        caption = og.replace(/^.*on Instagram:\s*/i, '').replace(/^["“]|["”]$/g, '').trim();
      } else {
        caption = og.trim();
      }
    }

    const comments = [];
    const seen = new Set();
    const timestampAnchors = Array.from(document.querySelectorAll('a[href*="/p/"][href*="/c/"]'));
    let seq = 0;

    for (const tsAnchor of timestampAnchors) {
      const href = tsAnchor.getAttribute('href') || '';
      if (shortcode && !href.includes(`/p/${shortcode}/c/`)) continue;
      const idMatch = href.match(/\/c\/(\d+)\//);
      if (!idMatch) continue;
      const commentId = idMatch[1];

      let block = tsAnchor.closest('div');
      for (let i = 0; i < 6 && block; i += 1) {
        const lineCount = (block.innerText || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).length;
        if (lineCount >= 3) break;
        block = block.parentElement;
      }
      if (!block) continue;

      const userAnchor = Array.from(block.querySelectorAll('a[href^="/"]')).find((a) => {
        const ah = a.getAttribute('href') || '';
        const text = (a.textContent || '').trim();
        return /^\/[^/?#]+\/?$/.test(ah) && text.length > 0;
      });
      if (!userAnchor) continue;

      const username = (userAnchor.textContent || '').trim();
      if (!username) continue;

      const lineTokens = (block.innerText || '')
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!lineTokens.length) continue;

      const likeLine = lineTokens.find((line) => /^\d+\s+likes?$/i.test(line)) || null;
      const likeCount = likeLine ? Number(likeLine.match(/^(\d+)/)?.[1] || NaN) : null;
      const relativeTime = (tsAnchor.textContent || '').trim();

      const cleaned = lineTokens.filter((line) => {
        if (!line) return false;
        if (line === username) return false;
        if (line === relativeTime) return false;
        if (/^\d+\s+likes?$/i.test(line)) return false;
        if (/^reply$/i.test(line)) return false;
        if (/^view all \d+ repl/i.test(line)) return false;
        if (/^load more repl/i.test(line)) return false;
        if (/^see translation$/i.test(line)) return false;
        if (/^translated$/i.test(line)) return false;
        return true;
      });

      const text = cleaned.join('\n').trim();
      if (!text) continue;

      const stableKey = `${commentId}|${username}|${text}`;
      if (seen.has(stableKey)) continue;
      seen.add(stableKey);

      const timeNode = block.querySelector('time[datetime]');
      comments.push({
        local_comment_id: `c_${seq++}`,
        parent_local_comment_id: null,
        comment_id: commentId,
        commenter_username: username,
        text,
        timestamp_iso: timeNode ? timeNode.getAttribute('datetime') : null,
        like_count: Number.isFinite(likeCount) ? likeCount : null
      });
    }

    return {
      page_url: location.href,
      caption,
      post_timestamp_iso: timestampIso,
      og_title: metaMap['og:title'] || null,
      og_type: metaMap['og:type'] || null,
      engagement_hint: metaMap['og:description'] || null,
      ld_json: ldJsonObjects,
      comments
    };
  }, shortcodeFromUrl);

  const comments = (extracted.comments || []).map((comment) => ({
    ...comment,
    comment_pseudonym: toPseudonym(comment.commenter_username, identitySecret)
  }));

  return {
    post_shortcode: shortcodeFromUrl,
    external_item_id: shortcodeFromUrl || extracted.page_url,
    post_url: extracted.page_url,
    post_timestamp_iso: extracted.post_timestamp_iso,
    caption: extracted.caption,
    engagement_hint: extracted.engagement_hint,
    comments
  };
}

function fileExtensionFromContentType(contentType, fallbackUrl) {
  const c = (contentType || '').toLowerCase();
  if (c.includes('image/jpeg')) return 'jpg';
  if (c.includes('image/png')) return 'png';
  if (c.includes('image/webp')) return 'webp';
  if (c.includes('video/mp4')) return 'mp4';
  if (c.includes('image/heic')) return 'heic';

  try {
    const pathname = new URL(fallbackUrl).pathname || '';
    const ext = pathname.split('.').pop();
    if (ext && ext.length <= 5) return ext.toLowerCase();
  } catch {
    // fallback below
  }

  return 'bin';
}

async function downloadMediaAsset(context, mediaUrl, destBasename, postUrl) {
  const response = await context.request.get(mediaUrl, {
    headers: {
      referer: postUrl
    },
    timeout: 45000
  });

  if (!response.ok()) {
    throw new Error(`Media download failed (${response.status()}) for ${mediaUrl}`);
  }

  const buffer = await response.body();
  const contentType = response.headers()['content-type'] || '';
  const ext = fileExtensionFromContentType(contentType, mediaUrl);
  const filename = `${destBasename}.${ext}`;
  const absPath = path.join(OUTPUT_MEDIA_DIR, filename);

  await fs.writeFile(absPath, buffer);

  return {
    local_path: path.relative(ROOT_DIR, absPath).replace(/\\/g, '/'),
    content_type: contentType || null,
    byte_size: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

async function appendJsonl(filePath, rows) {
  if (!rows.length) return;
  const payload = `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;
  await fs.appendFile(filePath, payload, 'utf8');
}

async function fetchMp4FallbackFromPost(context, postUrl) {
  const probe = await context.newPage();
  try {
    await probe.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await probe.waitForTimeout(4000);
    const html = await probe.content();
    const normalized = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    const matches = normalized.match(/https:\/\/[^"']+?\.mp4[^"']*/g) || [];
    return Array.from(new Set(matches.filter((u) => /^https?:\/\//i.test(u))))[0] || null;
  } catch {
    return null;
  } finally {
    await probe.close();
  }
}

async function run() {
  await loadDotEnv(path.join(ROOT_DIR, '.env'));

  const identitySecret = process.env.IDENTITY_HMAC_SECRET || '';
  if (!identitySecret) {
    throw new Error('Missing IDENTITY_HMAC_SECRET.');
  }

  const storageStatePath = resolveMaybeRelativePath(process.env.IG_SESSION_STATE_PATH || '');
  if (!storageStatePath) {
    throw new Error('Missing IG_SESSION_STATE_PATH.');
  }

  try {
    await fs.access(storageStatePath);
  } catch {
    throw new Error(`IG_SESSION_STATE_PATH does not exist: ${storageStatePath}`);
  }

  const urls = parseUrls();
  if (!urls.length) {
    throw new Error('No POST_URLS provided and default list is empty.');
  }

  const retries = Number(process.env.NAV_MAX_RETRIES || 3);
  const expansionSteps = Number(process.env.COMMENT_EXPANSION_MAX_STEPS || 400);
  const headless = process.env.HEADLESS !== '0';

  await ensureDir(OUTPUT_RAW_DIR);
  await ensureDir(OUTPUT_MEDIA_DIR);
  await ensureDir(OUTPUT_NORM_DIR);

  const rawPostsPath = path.join(OUTPUT_RAW_DIR, 'posts.jsonl');
  const discoursePath = path.join(OUTPUT_NORM_DIR, 'discourse_items.jsonl');
  const accountsPath = path.join(OUTPUT_NORM_DIR, 'accounts.jsonl');

  await fs.writeFile(rawPostsPath, '', 'utf8');
  await fs.writeFile(discoursePath, '', 'utf8');
  await fs.writeFile(accountsPath, '', 'utf8');

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: storageStatePath,
    viewport: { width: 1440, height: 1300 }
  });

  const runSummary = {
    started_at: new Date().toISOString(),
    urls,
    per_post: []
  };

  const rawPosts = [];

  for (const postUrl of urls) {
    const page = await context.newPage();
    const summary = {
      post_url: postUrl,
      ok: false,
      post_shortcode: extractShortcodeFromUrl(postUrl),
      comment_count: 0,
      media_count: 0,
      errors: []
    };

    try {
      await navigateToPost(page, postUrl, retries);
      await expandCaptionIfCollapsed(page);
      const shortcode = extractShortcodeFromUrl(postUrl);
      const media = await collectMediaAcrossCarousel(page, postUrl, shortcode, retries);
      if (!media.some((m) => m.media_type === 'VIDEO')) {
        const posterOnlyIndex = media.findIndex((m) => m.media_type === 'VIDEO_POSTER_ONLY');
        if (posterOnlyIndex >= 0) {
          const mp4 = await fetchMp4FallbackFromPost(context, postUrl);
          if (mp4) {
            media[posterOnlyIndex] = {
              ...media[posterOnlyIndex],
              media_type: 'VIDEO',
              media_url: mp4
            };
          }
        }
      }
      await expandAllCommentsAndReplies(page, expansionSteps);

      const postCore = await collectPostAndCommentData(page, postUrl, identitySecret);

      const mediaManifest = [];
      let postLevelMp4Fallback = null;
      for (let i = 0; i < media.length; i += 1) {
        let item = media[i];
        if (item.media_type === 'VIDEO_POSTER_ONLY') {
          if (!postLevelMp4Fallback) {
            postLevelMp4Fallback = await fetchMp4FallbackFromPost(context, postCore.post_url);
          }
          if (postLevelMp4Fallback) {
            item = {
              ...item,
              media_type: 'VIDEO',
              media_url: postLevelMp4Fallback
            };
          }
        }
        if (String(item.media_url || '').startsWith('blob:')) {
          summary.errors.push(`media_download_skipped_blob_url:${item.media_url}`);
          mediaManifest.push({ ...item, local_path: null, byte_size: null, sha256: null, content_type: null });
          continue;
        }
        try {
          const local = await withRetries(
            () => downloadMediaAsset(context, item.media_url, `${postCore.post_shortcode || 'post'}_${String(i + 1).padStart(2, '0')}`, postCore.post_url),
            retries,
            `download:${postCore.post_shortcode || 'post'}:${i}`
          );
          mediaManifest.push({ ...item, ...local });
        } catch (err) {
          summary.errors.push(`media_download_failed:${item.media_url}:${err.message}`);
          mediaManifest.push({ ...item, local_path: null, byte_size: null, sha256: null, content_type: null });
        }
      }

      const postRecord = {
        collected_at: new Date().toISOString(),
        source_surface: 'INSTAGRAM',
        account_pseudonym: toPseudonym('bcgovfireinfo', identitySecret),
        ...postCore,
        media: mediaManifest,
        comments: postCore.comments.map((c) => ({
          local_comment_id: c.local_comment_id,
          parent_local_comment_id: c.parent_local_comment_id,
          comment_id: c.comment_id,
          text: c.text,
          timestamp_iso: c.timestamp_iso,
          like_count: c.like_count,
          comment_pseudonym: c.comment_pseudonym
        }))
      };

      rawPosts.push(postRecord);

      summary.ok = true;
      summary.comment_count = postRecord.comments.length;
      summary.media_count = postRecord.media.length;
      summary.post_shortcode = postRecord.post_shortcode;
    } catch (err) {
      summary.errors.push(err.message || String(err));
    } finally {
      runSummary.per_post.push(summary);
      await page.close();
    }
  }

  await browser.close();

  await appendJsonl(rawPostsPath, rawPosts);

  const normalized = normalizePosts(rawPosts);
  await appendJsonl(discoursePath, normalized.discourseItems);
  await appendJsonl(accountsPath, normalized.accounts);

  runSummary.completed_at = new Date().toISOString();
  runSummary.ok_count = runSummary.per_post.filter((x) => x.ok).length;
  runSummary.fail_count = runSummary.per_post.filter((x) => !x.ok).length;

  await fs.writeFile(path.join(OUTPUT_RAW_DIR, 'run_summary.json'), JSON.stringify(runSummary, null, 2), 'utf8');

  console.log(JSON.stringify({
    message: 'Pilot extraction finished',
    outputs: {
      raw_posts: path.relative(ROOT_DIR, rawPostsPath).replace(/\\/g, '/'),
      discourse_items: path.relative(ROOT_DIR, discoursePath).replace(/\\/g, '/'),
      accounts: path.relative(ROOT_DIR, accountsPath).replace(/\\/g, '/'),
      run_summary: 'output/raw/run_summary.json'
    },
    summary: {
      urls_total: urls.length,
      urls_ok: runSummary.ok_count,
      urls_failed: runSummary.fail_count
    }
  }, null, 2));
}

run().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exitCode = 1;
});
