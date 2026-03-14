const state = {
  accounts: [],
  runs: [],
  posts: [],
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
  accountForm: document.getElementById('account-form'),
  newAccount: document.getElementById('new-account'),
  accounts: document.getElementById('accounts'),
  runs: document.getElementById('runs'),
  accountFilter: document.getElementById('account-filter'),
  posts: document.getElementById('posts'),
  detailTitle: document.getElementById('detail-title'),
  detailLink: document.getElementById('detail-link'),
  detailMeta: document.getElementById('detail-meta'),
  mediaIndex: document.getElementById('media-index'),
  mediaView: document.getElementById('media-view'),
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

function fmtDate(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function renderAccounts() {
  el.accounts.innerHTML = state.accounts.map((a) => `
    <div class="row">
      <div class="row-head">
        <strong>@${a.handle}</strong>
        <button data-remove="${a.handle}">Remove</button>
      </div>
      <div class="muted">Last checked: ${fmtDate(a.last_checked_at)} | Last run: ${a.last_run_id || 'n/a'}</div>
    </div>
  `).join('') || '<p class="muted">No monitored accounts yet.</p>';

  el.accountFilter.innerHTML = '<option value="">All</option>' +
    state.accounts.map((a) => `<option value="${a.handle}">@${a.handle}</option>`).join('');
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
  el.runs.innerHTML = state.runs.map((r) => {
    const stats = r.stats || {};
    return `
      <div class="row">
        <div class="row-head">
          <strong>#${r.run_id} ${r.status}</strong>
          <span class="muted">${r.trigger_mode}</span>
        </div>
        <div class="muted">${fmtDate(r.started_at)} -> ${fmtDate(r.completed_at)}</div>
        <div class="muted">Processed: ${stats.posts_processed || 0}, Failed: ${stats.posts_failed || 0}, Skipped cutoff: ${stats.posts_skipped_cutoff || 0}</div>
      </div>
    `;
  }).join('') || '<p class="muted">No runs yet.</p>';
}

function renderPosts() {
  el.posts.innerHTML = state.posts.map((p) => {
    const isActive = p.post_id === state.selectedPostId;
    return `
      <div class="post-item ${isActive ? 'active' : ''}" data-post-id="${p.post_id}">
        <div><strong>${p.post_shortcode}</strong> <span class="muted">@${p.account_handle}</span></div>
        <div class="muted">Published: ${fmtDate(p.published_at)}</div>
        <div class="muted">Media: ${p.media_count} | Comments: ${p.comment_count}</div>
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
    el.mediaView.innerHTML = '<p style="color:#fff">No media</p>';
    return;
  }

  state.mediaIndex = Math.max(0, Math.min(state.mediaIndex, media.length - 1));
  const item = media[state.mediaIndex];
  el.mediaIndex.textContent = `${state.mediaIndex + 1} / ${media.length}`;

  const src = item.local_path ? `../${item.local_path}` : item.media_url;
  if (/\.(mp4|webm|mov)$/i.test(src) || item.media_type === 'VIDEO') {
    el.mediaView.innerHTML = `<video controls src="${src}"></video>`;
  } else {
    el.mediaView.innerHTML = `<img src="${src}" alt="post media" loading="lazy" />`;
  }
}

function renderDetail() {
  const d = state.selectedPostDetail;
  if (!d) {
    el.detailTitle.textContent = 'Select a post';
    el.detailMeta.textContent = '';
    el.detailLink.href = '#';
    el.caption.textContent = '';
    el.comments.innerHTML = '';
    renderMedia();
    return;
  }

  el.detailTitle.textContent = `${d.post_shortcode} (@${d.account_handle})`;
  el.detailLink.href = d.post_url;
  el.detailMeta.textContent = `Published: ${fmtDate(d.published_at)} | Last collected: ${fmtDate(d.last_collected_at)} | Media: ${d.media_count}`;
  el.caption.textContent = d.caption || '(no caption)';

  const comments = d.comments || [];
  el.comments.innerHTML = comments.length
    ? comments.map((c) => `
      <article class="comment">
        <div class="muted">${c.actor_pseudonym} | ${fmtDate(c.published_at)}${Number.isFinite(c.like_count) ? ` | ${c.like_count} likes` : ''}</div>
        <div>${(c.content_text || '').replace(/</g, '&lt;')}</div>
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

  if (state.runs[0]?.run_id && state.runs[0].run_id !== state.lastRunId) {
    state.lastRunId = state.runs[0].run_id;
  }

  if (checkSelection) {
    if (state.selectedPostId && !state.posts.some((p) => p.post_id === state.selectedPostId)) {
      state.selectedPostId = null;
      state.selectedPostDetail = null;
    }
  }

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
    document.body.innerHTML = `<pre style="padding:16px">Failed to initialize research console: ${err.message}</pre>`;
  }
})();
