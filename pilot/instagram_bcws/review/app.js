const state = {
  accounts: [],
  runs: [],
  posts: [],
  sync: null,
  selectedPostId: null,
  selectedPostDetail: null,
  mediaIndex: 0,
  lastRunId: null,
  pollingMs: 15000,
  accountFilter: ''
};

const el = {
  syncAll: document.getElementById('sync-all'),
  syncStatus: document.getElementById('sync-status'),
  summarySync: document.getElementById('summary-sync'),
  summarySyncMeta: document.getElementById('summary-sync-meta'),
  summaryRun: document.getElementById('summary-run'),
  summaryRunMeta: document.getElementById('summary-run-meta'),
  summaryAttention: document.getElementById('summary-attention'),
  summaryAttentionMeta: document.getElementById('summary-attention-meta'),
  summaryPosts: document.getElementById('summary-posts'),
  summaryPostsMeta: document.getElementById('summary-posts-meta'),
  accountForm: document.getElementById('account-form'),
  newAccount: document.getElementById('new-account'),
  accounts: document.getElementById('accounts'),
  runs: document.getElementById('runs'),
  accountFilter: document.getElementById('account-filter'),
  posts: document.getElementById('posts'),
  detailTitle: document.getElementById('detail-title'),
  detailLink: document.getElementById('detail-link'),
  detailMeta: document.getElementById('detail-meta'),
  detailHealth: document.getElementById('detail-health'),
  mediaIndex: document.getElementById('media-index'),
  mediaView: document.getElementById('media-view'),
  mediaList: document.getElementById('media-list'),
  prevMedia: document.getElementById('prev-media'),
  nextMedia: document.getElementById('next-media'),
  caption: document.getElementById('caption'),
  comments: document.getElementById('comments')
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      if (payload.error) detail = payload.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(detail);
  }
  return res.json();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function badgeClass(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  if (normalized.includes('failed') || normalized.includes('partial') || normalized.includes('preserved')) return 'warn';
  if (normalized.includes('running')) return 'info';
  if (normalized.includes('complete') || normalized.includes('succeeded')) return 'ok';
  return 'neutral';
}

function renderBadge(label) {
  return `<span class="badge ${badgeClass(label)}">${escapeHtml(label || 'n/a')}</span>`;
}

function localMediaHref(localPath) {
  if (!localPath) return null;
  return `../${localPath}`;
}

function canonicalPostUrl(detail) {
  if (detail?.post_shortcode) {
    return `https://www.instagram.com/p/${detail.post_shortcode}/`;
  }
  return detail?.post_url || '#';
}

function firstAttentionPost() {
  return state.posts.find((post) => String(post.media_sync_status || '').toUpperCase() !== 'COMPLETE') || null;
}

function renderSummary() {
  if (state.sync) {
    el.summarySync.innerHTML = renderBadge('RUNNING');
    el.summarySyncMeta.textContent = `PID ${state.sync.pid} | Started ${fmtDate(state.sync.started_at)}${state.sync.account ? ` | @${state.sync.account}` : ''}`;
  } else {
    el.summarySync.innerHTML = renderBadge('IDLE');
    el.summarySyncMeta.textContent = 'No active sync process';
  }

  const latestRun = state.runs[0] || null;
  if (latestRun) {
    const stats = latestRun.stats || {};
    el.summaryRun.innerHTML = `#${latestRun.run_id} ${renderBadge(latestRun.status)}`;
    el.summaryRunMeta.textContent = `Processed ${stats.posts_processed || 0}, failed ${stats.posts_failed || 0}, preserved ${stats.posts_media_preserved || 0}, partial ${stats.posts_media_partial || 0}`;
  } else {
    el.summaryRun.textContent = 'n/a';
    el.summaryRunMeta.textContent = 'No runs yet';
  }

  const attentionPosts = state.posts.filter((post) => String(post.media_sync_status || '').toUpperCase() !== 'COMPLETE');
  el.summaryAttention.textContent = String(attentionPosts.length);
  if (attentionPosts.length) {
    const top = attentionPosts[0];
    el.summaryAttentionMeta.textContent = `${top.post_shortcode} @${top.account_handle} | ${top.media_sync_status || 'n/a'}`;
  } else {
    el.summaryAttentionMeta.textContent = 'No degraded posts in current list';
  }

  el.summaryPosts.textContent = String(state.posts.length);
  const completeCount = state.posts.filter((post) => String(post.media_sync_status || '').toUpperCase() === 'COMPLETE').length;
  el.summaryPostsMeta.textContent = `${completeCount} complete, ${state.posts.length - completeCount} need review`;
}

function renderAccounts() {
  el.accounts.innerHTML = state.accounts.map((account) => `
    <div class="row">
      <div class="row-head">
        <strong>@${escapeHtml(account.handle)}</strong>
        <button data-remove="${escapeHtml(account.handle)}">Remove</button>
      </div>
      <div class="muted">Last checked: ${fmtDate(account.last_checked_at)} | Last run: ${account.last_run_id || 'n/a'}</div>
    </div>
  `).join('') || '<p class="muted">No monitored accounts yet.</p>';

  el.accountFilter.innerHTML = '<option value="">All</option>' +
    state.accounts.map((account) => `<option value="${escapeHtml(account.handle)}">@${escapeHtml(account.handle)}</option>`).join('');
  el.accountFilter.value = state.accountFilter;

  el.accounts.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const handle = btn.getAttribute('data-remove');
      await api(`/api/accounts/${encodeURIComponent(handle)}`, { method: 'DELETE' });
      await refreshAll(true);
    });
  });
}

function renderRuns() {
  el.runs.innerHTML = state.runs.map((run) => {
    const stats = run.stats || {};
    const syncClass = String(run.status || '').toUpperCase() !== 'SUCCEEDED' ? 'needs-attention' : '';
    const errorPreview = Array.isArray(stats.errors) && stats.errors.length
      ? `<div class="error-preview">${escapeHtml(stats.errors.slice(0, 3).join(' | '))}</div>`
      : '';
    return `
      <div class="row ${syncClass}">
        <div class="row-head">
          <strong>#${run.run_id}</strong>
          ${renderBadge(run.status)}
        </div>
        <div class="muted">${escapeHtml(run.trigger_mode || 'unknown')} | ${fmtDate(run.started_at)} -> ${fmtDate(run.completed_at)}</div>
        <div class="stats-line">
          <span>Processed ${stats.posts_processed || 0}</span>
          <span>Failed ${stats.posts_failed || 0}</span>
          <span>Partial ${stats.posts_media_partial || 0}</span>
          <span>Preserved ${stats.posts_media_preserved || 0}</span>
          <span>Reconciled stale ${stats.stale_runs_reconciled || 0}</span>
        </div>
        ${run.error_text ? `<div class="error-preview">${escapeHtml(run.error_text)}</div>` : ''}
        ${errorPreview}
      </div>
    `;
  }).join('') || '<p class="muted">No runs yet.</p>';
}

function renderPosts() {
  const attention = firstAttentionPost();
  el.posts.innerHTML = state.posts.map((post) => {
    const isActive = post.post_id === state.selectedPostId;
    const needsAttention = String(post.media_sync_status || '').toUpperCase() !== 'COMPLETE';
    const classes = ['post-item'];
    if (isActive) classes.push('active');
    if (needsAttention) classes.push('needs-attention');
    if (attention && attention.post_id === post.post_id) classes.push('priority');
    return `
      <div class="${classes.join(' ')}" data-post-id="${escapeHtml(post.post_id)}">
        <div class="row-head">
          <div><strong>${escapeHtml(post.post_shortcode)}</strong> <span class="muted">@${escapeHtml(post.account_handle)}</span></div>
          ${renderBadge(post.media_sync_status || 'n/a')}
        </div>
        <div class="muted">Published: ${fmtDate(post.published_at)}</div>
        <div class="stats-line">
          <span>Media ${post.media_count}</span>
          <span>Saved ${post.media_saved_count ?? 'n/a'}</span>
          <span>Failed ${post.media_failed_count ?? 'n/a'}</span>
          <span>Comments ${post.comment_count}</span>
        </div>
        ${post.media_guard_reason ? `<div class="muted">Guard: ${escapeHtml(post.media_guard_reason)}</div>` : ''}
      </div>
    `;
  }).join('') || '<p class="muted">No posts found for current filter.</p>';

  el.posts.querySelectorAll('[data-post-id]').forEach((node) => {
    node.addEventListener('click', async () => {
      state.selectedPostId = node.getAttribute('data-post-id');
      state.mediaIndex = 0;
      await loadSelectedPost();
      renderPosts();
    });
  });
}

function renderMedia() {
  const media = state.selectedPostDetail?.media || [];
  if (!media.length) {
    el.mediaIndex.textContent = '0 / 0';
    el.mediaView.innerHTML = '<p class="media-empty">No media captured</p>';
    el.mediaList.innerHTML = '<p class="muted">No media rows saved for this post.</p>';
    return;
  }

  state.mediaIndex = Math.max(0, Math.min(state.mediaIndex, media.length - 1));
  const item = media[state.mediaIndex];
  el.mediaIndex.textContent = `${state.mediaIndex + 1} / ${media.length}`;

  const src = item.local_path ? localMediaHref(item.local_path) : item.media_url;
  if (src && (/\.(mp4|webm|mov)$/i.test(src) || item.media_type === 'VIDEO')) {
    el.mediaView.innerHTML = `<video controls src="${escapeHtml(src)}"></video>`;
  } else if (src) {
    el.mediaView.innerHTML = `<img src="${escapeHtml(src)}" alt="post media" loading="lazy" />`;
  } else {
    el.mediaView.innerHTML = '<p class="media-empty">Missing local media file and no remote URL available</p>';
  }

  el.mediaList.innerHTML = media.map((entry, index) => {
    const hasLocal = !!entry.local_path;
    const isMissing = !hasLocal;
    return `
      <div class="media-row ${index === state.mediaIndex ? 'active' : ''} ${isMissing ? 'needs-attention' : ''}" data-media-index="${index}">
        <div class="row-head">
          <strong>#${entry.media_index ?? index + 1} ${escapeHtml(entry.media_type || 'UNKNOWN')}</strong>
          ${renderBadge(hasLocal ? 'SAVED' : 'MISSING')}
        </div>
        <div class="muted">URL: ${escapeHtml(entry.media_url || 'n/a')}</div>
        <div class="muted">Local: ${hasLocal ? `<a href="${escapeHtml(localMediaHref(entry.local_path))}" target="_blank" rel="noreferrer">${escapeHtml(entry.local_path)}</a>` : 'missing'}</div>
        <div class="muted">SHA: ${escapeHtml(entry.sha256 || 'missing')} | Bytes: ${entry.byte_size ?? 'n/a'}</div>
      </div>
    `;
  }).join('');

  el.mediaList.querySelectorAll('[data-media-index]').forEach((node) => {
    node.addEventListener('click', () => {
      state.mediaIndex = Number(node.getAttribute('data-media-index'));
      renderMedia();
    });
  });
}

function renderDetail() {
  const detail = state.selectedPostDetail;
  if (!detail) {
    el.detailTitle.textContent = 'Select a post';
    el.detailMeta.textContent = '';
    el.detailHealth.innerHTML = '';
    el.detailLink.href = '#';
    el.caption.textContent = '';
    el.comments.innerHTML = '';
    renderMedia();
    return;
  }

  el.detailTitle.textContent = `${detail.post_shortcode} (@${detail.account_handle})`;
  const canonicalUrl = canonicalPostUrl(detail);
  el.detailLink.href = canonicalUrl;
  el.detailLink.textContent = canonicalUrl;
  el.detailMeta.innerHTML = `
    <div class="stats-line">
      <span>Published ${fmtDate(detail.published_at)}</span>
      <span>First collected ${fmtDate(detail.first_collected_at)}</span>
      <span>Last collected ${fmtDate(detail.last_collected_at)}</span>
    </div>
    <div class="stats-line">
      <span>Media count ${detail.media_count}</span>
      <span>Saved ${detail.media_saved_count ?? 'n/a'}</span>
      <span>Failed ${detail.media_failed_count ?? 'n/a'}</span>
    </div>
  `;
  el.detailHealth.innerHTML = `
    ${renderBadge(detail.media_sync_status || 'n/a')}
    ${detail.media_guard_reason ? `<span class="detail-note">Guard: ${escapeHtml(detail.media_guard_reason)}</span>` : ''}
  `;
  el.caption.textContent = detail.caption || '(no caption)';

  const comments = detail.comments || [];
  el.comments.innerHTML = comments.length
    ? comments.map((comment) => `
      <article class="comment">
        <div class="muted">${escapeHtml(comment.actor_pseudonym)} | ${fmtDate(comment.published_at)}${Number.isFinite(comment.like_count) ? ` | ${comment.like_count} likes` : ''}</div>
        <div>${escapeHtml(comment.content_text || '')}</div>
      </article>
    `).join('')
    : '<p class="muted">No comments captured.</p>';

  renderMedia();
}

async function loadSelectedPost() {
  if (!state.selectedPostId) {
    state.selectedPostDetail = null;
    renderDetail();
    return;
  }
  state.selectedPostDetail = await api(`/api/posts/${encodeURIComponent(state.selectedPostId)}`);
  renderDetail();
}

async function refreshAll(checkSelection = false) {
  const [accountsPayload, runsPayload, postsPayload] = await Promise.all([
    api('/api/accounts'),
    api('/api/runs?limit=20'),
    api(`/api/posts?limit=150${state.accountFilter ? `&account=${encodeURIComponent(state.accountFilter)}` : ''}`)
  ]);

  state.accounts = accountsPayload.items || [];
  state.runs = runsPayload.items || [];
  state.posts = postsPayload.items || [];
  state.sync = runsPayload.sync || null;

  if (state.runs[0]?.run_id && state.runs[0].run_id !== state.lastRunId) {
    state.lastRunId = state.runs[0].run_id;
  }

  if (checkSelection && state.selectedPostId && !state.posts.some((post) => post.post_id === state.selectedPostId)) {
    state.selectedPostId = null;
    state.selectedPostDetail = null;
  }

  renderSummary();
  renderAccounts();
  renderRuns();
  renderPosts();
  if (state.selectedPostId) {
    await loadSelectedPost();
  } else {
    renderDetail();
  }
}

function wireEvents() {
  el.syncAll.addEventListener('click', async () => {
    try {
      el.syncStatus.textContent = 'Running...';
      await api('/api/sync', { method: 'POST', body: JSON.stringify({}) });
      el.syncStatus.textContent = 'Sync finished';
      await refreshAll(true);
    } catch (err) {
      el.syncStatus.textContent = `Sync failed: ${err.message}`;
    }
  });

  el.accountForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const handle = String(el.newAccount.value || '').trim();
    if (!handle) return;
    try {
      el.syncStatus.textContent = `Adding @${handle} and backfilling...`;
      await api('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ handle, backfill: true })
      });
      el.newAccount.value = '';
      el.syncStatus.textContent = 'Account added';
      await refreshAll(true);
    } catch (err) {
      el.syncStatus.textContent = `Add failed: ${err.message}`;
    }
  });

  el.accountFilter.addEventListener('change', async () => {
    state.accountFilter = el.accountFilter.value;
    await refreshAll(true);
  });

  el.prevMedia.addEventListener('click', () => {
    const media = state.selectedPostDetail?.media || [];
    if (!media.length) return;
    state.mediaIndex = (state.mediaIndex - 1 + media.length) % media.length;
    renderMedia();
  });

  el.nextMedia.addEventListener('click', () => {
    const media = state.selectedPostDetail?.media || [];
    if (!media.length) return;
    state.mediaIndex = (state.mediaIndex + 1) % media.length;
    renderMedia();
  });
}

(async function init() {
  try {
    wireEvents();
    await refreshAll(true);
    setInterval(async () => {
      try {
        await refreshAll(true);
      } catch {
        // keep UI stable during polling errors
      }
    }, state.pollingMs);
  } catch (err) {
    document.body.innerHTML = `<pre style="padding:16px">Failed to initialize research console: ${escapeHtml(err.message)}</pre>`;
  }
})();
