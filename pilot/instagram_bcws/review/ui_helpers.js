export function canonicalizeInstagramUrl(rawUrl) {
  if (!rawUrl) return null;

  let url;
  try {
    url = new URL(String(rawUrl), 'https://www.instagram.com');
  } catch {
    return null;
  }

  const parts = url.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  const surfaceIndex = parts.findIndex((part) => /^(p|reel)$/i.test(part));
  if (surfaceIndex === -1) return null;

  const shortcode = parts[surfaceIndex + 1];
  if (!shortcode) return null;

  return `https://www.instagram.com/${parts[surfaceIndex].toLowerCase()}/${encodeURIComponent(shortcode)}/`;
}

export function deriveCanonicalPostUrl(detail) {
  const preferred = canonicalizeInstagramUrl(detail?.post_url);
  if (preferred) return preferred;

  const shortcode = String(detail?.post_shortcode || '').trim();
  if (!shortcode) return detail?.post_url || '#';

  const surface = /\/reel\//i.test(String(detail?.post_url || '')) ? 'reel' : 'p';
  return `https://www.instagram.com/${surface}/${encodeURIComponent(shortcode)}/`;
}

export function toBrowserMediaHref(localPath) {
  if (!localPath) return null;
  if (/^https?:\/\//i.test(localPath)) return localPath;

  const segments = String(localPath)
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));

  if (!segments.length) return null;
  return `/${segments.join('/')}`;
}

export function describeMediaHealth(record) {
  return {
    status: record?.media_sync_status || 'n/a',
    savedCount: record?.media_saved_count ?? 'n/a',
    failedCount: record?.media_failed_count ?? 'n/a',
    guardReason: record?.media_guard_reason || null
  };
}
