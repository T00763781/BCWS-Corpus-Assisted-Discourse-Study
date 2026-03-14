let posts = [];
let postIndex = 0;
let mediaIndex = 0;

const postIndexEl = document.getElementById('post-index');
const postLinkEl = document.getElementById('post-link');
const postStatsEl = document.getElementById('post-stats');
const mediaIndexEl = document.getElementById('media-index');
const mediaViewEl = document.getElementById('media-view');
const captionEl = document.getElementById('caption');
const commentsEl = document.getElementById('comments');

async function loadPosts() {
  const res = await fetch('../output/raw/posts.jsonl');
  const text = await res.text();
  posts = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  if (!posts.length) {
    throw new Error('No posts found in output/raw/posts.jsonl');
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function renderMedia(post) {
  const media = post.media || [];
  if (!media.length) {
    mediaViewEl.innerHTML = '<p style="color:#fff">No media</p>';
    mediaIndexEl.textContent = '0 / 0';
    return;
  }

  mediaIndex = clamp(mediaIndex, 0, media.length - 1);
  const item = media[mediaIndex];
  mediaIndexEl.textContent = `${mediaIndex + 1} / ${media.length}`;

  if (item.local_path && /\.(mp4|webm|mov)$/i.test(item.local_path)) {
    mediaViewEl.innerHTML = `<video controls src="../${item.local_path}"></video>`;
    return;
  }

  const src = item.local_path ? `../${item.local_path}` : item.media_url;
  mediaViewEl.innerHTML = `<img src="${src}" alt="post media" loading="lazy" />`;
}

function renderComments(post) {
  const comments = post.comments || [];
  if (!comments.length) {
    commentsEl.innerHTML = '<p>No comments extracted.</p>';
    return;
  }

  commentsEl.innerHTML = comments
    .map((c) => `
      <article class="comment">
        <div class="comment-head">${c.comment_pseudonym} • ${c.timestamp_iso || 'time n/a'}${typeof c.like_count === 'number' ? ` • ${c.like_count} likes` : ''}</div>
        <div>${(c.text || '').replace(/</g, '&lt;')}</div>
      </article>
    `)
    .join('');
}

function render() {
  const post = posts[postIndex];
  postIndexEl.textContent = `${postIndex + 1} / ${posts.length} (${post.post_shortcode || 'unknown'})`;
  postLinkEl.href = post.post_url;
  postStatsEl.textContent = `Media: ${(post.media || []).length} | Comments: ${(post.comments || []).length} | Collected: ${post.collected_at || 'n/a'}`;
  captionEl.textContent = post.caption || '(no caption)';
  renderMedia(post);
  renderComments(post);
}

function wireEvents() {
  document.getElementById('prev-post').addEventListener('click', () => {
    postIndex = (postIndex - 1 + posts.length) % posts.length;
    mediaIndex = 0;
    render();
  });

  document.getElementById('next-post').addEventListener('click', () => {
    postIndex = (postIndex + 1) % posts.length;
    mediaIndex = 0;
    render();
  });

  document.getElementById('prev-media').addEventListener('click', () => {
    const total = (posts[postIndex].media || []).length;
    if (!total) return;
    mediaIndex = (mediaIndex - 1 + total) % total;
    renderMedia(posts[postIndex]);
  });

  document.getElementById('next-media').addEventListener('click', () => {
    const total = (posts[postIndex].media || []).length;
    if (!total) return;
    mediaIndex = (mediaIndex + 1) % total;
    renderMedia(posts[postIndex]);
  });
}

(async function init() {
  try {
    await loadPosts();
    wireEvents();
    render();
  } catch (err) {
    document.body.innerHTML = `<pre style="padding:16px">Failed to load review UI: ${err.message}</pre>`;
  }
})();