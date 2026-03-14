const CANONICAL_INSTAGRAM_ORIGIN = 'https://www.instagram.com';
const SHORTCODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export function normalizeInstagramPostUrl(rawUrl) {
  if (!rawUrl) return null;

  let url;
  try {
    url = new URL(String(rawUrl), CANONICAL_INSTAGRAM_ORIGIN);
  } catch {
    return null;
  }

  const parts = url.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) return null;

  const [surface, shortcode] = parts;
  if (!/^(p|reel)$/i.test(surface)) return null;
  if (!SHORTCODE_PATTERN.test(shortcode)) return null;

  return `${CANONICAL_INSTAGRAM_ORIGIN}/${surface.toLowerCase()}/${shortcode}/`;
}

export function extractShortcodeFromUrl(rawUrl) {
  const normalized = normalizeInstagramPostUrl(rawUrl);
  if (!normalized) return null;
  const parts = new URL(normalized).pathname.split('/').filter(Boolean);
  return parts[1] || null;
}

export function canonicalMediaKey(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl);
  }
}

export function appendUniqueMediaItem(media, seenKeys, item, expectedShortcode) {
  if (!item?.media_url) return false;
  if (String(item.media_url).startsWith('blob:')) return false;
  if (!isLikelyPostMediaUrl(item.media_url, item.media_type, expectedShortcode)) return false;

  const key = canonicalMediaKey(item.media_url);
  if (!key || seenKeys.has(key)) return false;

  seenKeys.add(key);
  media.push(item);
  return true;
}

export function isLikelyPostMediaUrl(url, mediaType, expectedShortcode) {
  if (!url) return false;
  if (String(url).startsWith('blob:')) return false;
  if (mediaType === 'VIDEO') return /^https?:\/\//i.test(url);
  if (!/^https?:\/\//i.test(url)) return false;
  if (url.includes('/t51.') && url.includes('-19/')) return false;
  if (expectedShortcode && !url.includes(expectedShortcode) && url.includes('/t51.2885-19/')) return false;
  if (url.includes('/t51.') && url.includes('-15/')) return true;
  return mediaType === 'VIDEO';
}

export function summarizeMediaManifest(media) {
  const items = Array.isArray(media) ? media : [];
  const totalCount = items.length;
  const savedCount = items.filter((item) => !!item?.local_path && !!item?.sha256).length;
  const failedCount = items.filter((item) => item?.download_status === 'FAILED').length;
  const pendingCount = totalCount - savedCount - failedCount;

  let status = 'EMPTY';
  if (totalCount > 0 && savedCount === totalCount) {
    status = 'COMPLETE';
  } else if (savedCount > 0 || failedCount > 0 || pendingCount > 0) {
    status = 'PARTIAL';
  }

  return {
    status,
    total_count: totalCount,
    saved_count: savedCount,
    failed_count: failedCount,
    pending_count: pendingCount
  };
}

export function canApplyPostLevelVideoFallback(media) {
  return Array.isArray(media)
    && media.length === 1
    && media[0]?.media_type === 'VIDEO_POSTER_ONLY';
}

export function decideMediaReplacement(existingMedia, nextMedia) {
  const current = summarizeMediaManifest(existingMedia);
  const incoming = summarizeMediaManifest(nextMedia);

  if (incoming.total_count === 0) {
    return {
      replace: current.total_count === 0,
      reason: current.total_count === 0 ? 'no_media_on_either_side' : 'incoming_media_empty',
      incoming,
      current
    };
  }

  if (current.total_count === 0) {
    return {
      replace: incoming.saved_count > 0,
      reason: incoming.saved_count > 0 ? 'initial_media_capture' : 'incoming_media_unsaved',
      incoming,
      current
    };
  }

  if (incoming.status !== 'COMPLETE') {
    return {
      replace: false,
      reason: 'incoming_media_incomplete',
      incoming,
      current
    };
  }

  if (incoming.total_count < current.total_count) {
    return {
      replace: false,
      reason: 'incoming_media_count_regressed',
      incoming,
      current
    };
  }

  return {
    replace: true,
    reason: current.total_count === incoming.total_count ? 'incoming_media_complete' : 'incoming_media_expanded',
    incoming,
    current
  };
}
