import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { toPseudonym } from '../hash_identity.mjs';
import { normalizePosts } from '../normalize_output.mjs';
import { OUTPUT_MEDIA_DIR, ROOT_DIR, ensureDir, withRetries } from './config.mjs';
import {
  appendUniqueMediaItem,
  canApplyPostLevelVideoFallback,
  extractShortcodeFromUrl,
  normalizeInstagramPostUrl,
  summarizeMediaManifest
} from './instagram_common.mjs';

export async function createInstagramSession(storageStatePath, headless) {
  await ensureDir(OUTPUT_MEDIA_DIR);
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: storageStatePath,
    viewport: { width: 1440, height: 1300 }
  });
  return {
    browser,
    context,
    async close() {
      await browser.close();
    }
  };
}

export async function discoverAccountPostUrls(context, handle, options) {
  const account = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!account) throw new Error('Account handle required.');

  const maxScrolls = options.profileDiscoveryMaxScrolls || 80;
  const idleLimit = options.profileDiscoveryIdleRounds || 6;

  const urls = new Set();
  const page = await context.newPage();
  const tabUrls = [
    `https://www.instagram.com/${account}/`,
    `https://www.instagram.com/${account}/reels/`
  ];

  for (const tabUrl of tabUrls) {
    await page.goto(tabUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1400);

    let idleRounds = 0;
    for (let i = 0; i < maxScrolls; i += 1) {
      const found = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
          .map((a) => a.getAttribute('href') || '')
          .filter(Boolean);
      });

      let added = 0;
      for (const u of found) {
        const normalized = normalizeInstagramPostUrl(u);
        if (!normalized) continue;
        if (!urls.has(normalized)) {
          urls.add(normalized);
          added += 1;
        }
      }

      if (added === 0) {
        idleRounds += 1;
      } else {
        idleRounds = 0;
      }

      if (idleRounds >= idleLimit) break;

      await page.mouse.wheel(0, 2600);
      await page.waitForTimeout(700);
    }
  }

  await page.close();
  return Array.from(urls);
}

async function navigateToPost(page, url, retries) {
  await withRetries(
    async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      const hasContentRoot = await page.locator('main, article, [role="main"]').count();
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

    if (idleRounds >= 4) break;
  }
}

async function collectMediaAcrossCarousel(page, postUrl, shortcode) {
  const media = [];
  const seenUrls = new Set();

  async function detectExpectedSlideCount() {
    const count = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('main span, main div, article span, article div'));
      for (const node of nodes) {
        const t = (node.textContent || '').trim();
        const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) {
          const total = Number(m[2]);
          if (Number.isFinite(total) && total > 1 && total <= 40) return total;
        }
      }
      return null;
    });
    return count || null;
  }

  async function readOgMediaCandidate() {
    const item = await page.evaluate(() => {
      const ogVideo = document.querySelector('meta[property="og:video"]')?.getAttribute('content')
        || document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content')
        || null;
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
      if (ogVideo) {
        return {
          media_type: 'VIDEO',
          media_url: ogVideo,
          poster_url: ogImage || null
        };
      }
      if (ogImage) {
        return {
          media_type: 'IMAGE',
          media_url: ogImage
        };
      }
      return null;
    });
    return item;
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

  function mediaIdToken(url) {
    try {
      const base = new URL(url).pathname.split('/').pop() || '';
      const match = base.match(/_(\d{8,})_/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async function clickNextControl() {
    return await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      const next = candidates.find((node) => {
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('next')) return true;
        const text = (node.textContent || '').trim().toLowerCase();
        return text === 'next';
      });
      if (!next) return false;
      const rect = next.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      next.click();
      return true;
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
          const current = candidates[0]?.src || null;
          if (!current) return false;
          try {
            const url = new URL(current);
            return `${url.origin}${url.pathname}` !== prevKey;
          } catch {
            return current !== prevKey;
          }
        }, previousMediaKey, { timeout: 2500 });
        return true;
      } catch {
        // try another click
      }
    }
    return false;
  }

  async function extractMp4FromHtml(html) {
    const normalized = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    const matches = normalized.match(/https:\/\/[^"']+?\.mp4[^"']*/g) || [];
    const unique = Array.from(new Set(matches.filter((u) => /^https?:\/\//i.test(u))));
    return unique[0] || null;
  }

  async function readCurrentSlideCandidate() {
    const visibleItems = await readVisibleMediaCandidates();
    const videoCandidate = visibleItems.find((item) => item.media_type === 'VIDEO');
    if (videoCandidate?.media_url) return videoCandidate;
    if (visibleItems[0]?.media_url) return visibleItems[0];
    const ogItem = await readOgMediaCandidate();
    return ogItem?.media_url ? ogItem : null;
  }

  async function probeMissingByIndex(expectedCount) {
    for (let slideIndex = 1; slideIndex <= expectedCount; slideIndex += 1) {
      const target = new URL(postUrl);
      target.searchParams.set('img_index', String(slideIndex));
      try {
        await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(600);
      } catch {
        continue;
      }

      const item = await readCurrentSlideCandidate();
      if (!item) continue;
      appendUniqueMediaItem(media, seenUrls, {
        ...item,
        media_index: slideIndex
      }, shortcode);
    }
  }

  const expectedSlides = await detectExpectedSlideCount();
  const carouselMode = await hasNextControl();
  if (carouselMode && /\/p\//i.test(postUrl)) {
    const maxIterations = expectedSlides ? Math.max(8, expectedSlides * 2) : 24;
    let anchorPrefix = null;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const visibleItems = await readVisibleMediaCandidates();
      const candidates = visibleItems.length ? visibleItems : [await readOgMediaCandidate()].filter(Boolean);

      for (const item of candidates) {
        if (!item?.media_url) continue;
        if (item.media_type === 'IMAGE') {
          const token = mediaIdToken(item.media_url);
          if (!anchorPrefix && token) {
            anchorPrefix = token.slice(0, 7);
          } else if (anchorPrefix && token && !token.startsWith(anchorPrefix)) {
            continue;
          }
        }

        appendUniqueMediaItem(media, seenUrls, {
          ...item,
          media_index: media.length + 1
        }, shortcode);
      }

      if (expectedSlides && media.length >= expectedSlides) break;

      const prevKey = visibleItems[0]?.media_url
        ? (() => {
            try {
              const current = new URL(visibleItems[0].media_url);
              return `${current.origin}${current.pathname}`;
            } catch {
              return visibleItems[0].media_url;
            }
          })()
        : null;
      const advanced = await advanceToNextDistinctSlide(prevKey);
      if (!advanced) break;
    }

    if (expectedSlides && media.length < expectedSlides) {
      await probeMissingByIndex(expectedSlides);
    }
  } else {
    const candidate = await readCurrentSlideCandidate();
    if (candidate) {
      appendUniqueMediaItem(media, seenUrls, { ...candidate, media_index: 1 }, shortcode);
    }
  }

  if (canApplyPostLevelVideoFallback(media)) {
    const fallbackMp4 = await extractMp4FromHtml(await page.content());
    if (fallbackMp4) {
      media[0] = {
        ...media[0],
        media_type: 'VIDEO',
        media_url: fallbackMp4
      };
    }
  }

  return media;
}

function sanitizePathSegment(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function postDateFolder(postTimestampIso) {
  if (!postTimestampIso) return 'unknown-date';
  const d = new Date(postTimestampIso);
  if (Number.isNaN(d.getTime())) return 'unknown-date';
  return d.toISOString().slice(0, 10);
}

function fileExtensionFromContentType(contentType, fallbackUrl) {
  const c = (contentType || '').toLowerCase();
  if (c.includes('image/jpeg')) return 'jpg';
  if (c.includes('image/png')) return 'png';
  if (c.includes('image/webp')) return 'webp';
  if (c.includes('video/mp4')) return 'mp4';

  try {
    const pathname = new URL(fallbackUrl).pathname || '';
    const ext = pathname.split('.').pop();
    if (ext && ext.length <= 5) return ext.toLowerCase();
  } catch {
    // fallback below
  }

  return 'bin';
}

async function downloadMediaAsset(context, mediaUrl, destInfo, postUrl) {
  const response = await context.request.get(mediaUrl, {
    headers: { referer: postUrl },
    timeout: 45000
  });

  if (!response.ok()) {
    throw new Error(`Media download failed (${response.status()}) for ${mediaUrl}`);
  }

  const buffer = await response.body();
  const contentType = response.headers()['content-type'] || '';
  const ext = fileExtensionFromContentType(contentType, mediaUrl);
  const accountSeg = sanitizePathSegment(destInfo.accountHandle);
  const dateSeg = postDateFolder(destInfo.postTimestampIso);
  const postSeg = sanitizePathSegment(destInfo.postShortcode);
  const mediaBase = `${postSeg}_${String(destInfo.mediaIndex).padStart(2, '0')}.${ext}`;
  const absPath = path.join(OUTPUT_MEDIA_DIR, accountSeg, dateSeg, postSeg, mediaBase);
  await ensureDir(path.dirname(absPath));

  await fs.writeFile(absPath, buffer);

  return {
    local_path: path.relative(ROOT_DIR, absPath).replace(/\\/g, '/'),
    content_type: contentType || null,
    byte_size: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
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

    const contentRoot = document.querySelector('main, article, [role="main"]') || document;
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
    const anchors = Array.from(document.querySelectorAll('a[href*="/c/"]'));
    let seq = 0;

    for (const tsAnchor of anchors) {
      const href = tsAnchor.getAttribute('href') || '';
      if (shortcode && !href.includes(`/${shortcode}/c/`)) continue;
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

      const time = block.querySelector('time[datetime]');
      comments.push({
        local_comment_id: `c_${seq++}`,
        parent_local_comment_id: null,
        comment_id: commentId,
        commenter_username: username,
        text,
        timestamp_iso: time ? time.getAttribute('datetime') : null,
        like_count: Number.isFinite(likeCount) ? likeCount : null
      });
    }

    return {
      page_url: location.href,
      caption,
      post_timestamp_iso: timestampIso,
      engagement_hint: metaMap['og:description'] || null,
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

export async function scrapePostRecord(context, postUrl, accountHandle, config) {
  const page = await context.newPage();
  try {
    await navigateToPost(page, postUrl, config.navMaxRetries);
    const canonicalPostUrl = normalizeInstagramPostUrl(postUrl) || postUrl;
    await expandCaptionIfCollapsed(page);
    const shortcode = extractShortcodeFromUrl(canonicalPostUrl);
    const media = await collectMediaAcrossCarousel(page, postUrl, shortcode);
    if (page.url() !== canonicalPostUrl) {
      await navigateToPost(page, canonicalPostUrl, config.navMaxRetries);
      await expandCaptionIfCollapsed(page);
    }
    await expandAllCommentsAndReplies(page, config.commentExpansionMaxSteps);

    const postCore = await collectPostAndCommentData(page, postUrl, config.identitySecret);
    const mediaManifest = [];

    for (let i = 0; i < media.length; i += 1) {
      const item = media[i];
      if (String(item.media_url || '').startsWith('blob:')) {
        mediaManifest.push({
          ...item,
          local_path: null,
          byte_size: null,
          sha256: null,
          content_type: null,
          download_status: 'FAILED',
          error_message: 'blob_url_not_downloadable'
        });
        continue;
      }
      try {
        const local = await withRetries(
          () => downloadMediaAsset(context, item.media_url, {
            accountHandle,
            postTimestampIso: postCore.post_timestamp_iso,
            postShortcode: postCore.post_shortcode || 'post',
            mediaIndex: i + 1
          }, postCore.post_url),
          config.navMaxRetries,
          `download:${postCore.post_shortcode || 'post'}:${i}`
        );
        mediaManifest.push({ ...item, ...local, download_status: 'SAVED', error_message: null });
      } catch (err) {
        mediaManifest.push({
          ...item,
          local_path: null,
          byte_size: null,
          sha256: null,
          content_type: null,
          download_status: 'FAILED',
          error_message: err.message || String(err)
        });
      }
    }

    const mediaSummary = summarizeMediaManifest(mediaManifest);

    const postRecord = {
      collected_at: new Date().toISOString(),
      source_surface: 'INSTAGRAM',
      account_handle: accountHandle,
      account_pseudonym: toPseudonym(accountHandle, config.identitySecret),
      ...postCore,
      media_summary: mediaSummary,
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

    const normalized = normalizePosts([postRecord]);
    return {
      postRecord,
      normalizedPostItem: normalized.discourseItems.find((x) => x.item_type === 'POST') || null,
      normalizedComments: normalized.discourseItems.filter((x) => x.item_type === 'COMMENT'),
      normalizedAccounts: normalized.accounts
    };
  } finally {
    await page.close();
  }
}

export function isPostAfterCutoff(postRecord, cutoffIso) {
  if (!postRecord?.post_timestamp_iso) return true;
  const ts = new Date(postRecord.post_timestamp_iso);
  const cutoff = new Date(cutoffIso);
  if (Number.isNaN(ts.getTime()) || Number.isNaN(cutoff.getTime())) return true;
  return ts >= cutoff;
}

export async function collectTargetsForAccount(context, handle, options) {
  const discovered = await discoverAccountPostUrls(context, handle, options);
  const map = new Map();
  for (const url of discovered) {
    const shortcode = extractShortcodeFromUrl(url);
    if (!shortcode) continue;
    map.set(shortcode, url);
  }
  return map;
}
