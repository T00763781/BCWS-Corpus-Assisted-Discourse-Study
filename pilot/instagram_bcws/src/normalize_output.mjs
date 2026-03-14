function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizePostItem(rawPost) {
  const postId = `ig_post_${rawPost.post_shortcode || rawPost.external_item_id || 'unknown'}`;
  return {
    discourse_item_id: postId,
    platform: 'INSTAGRAM',
    item_type: 'POST',
    external_item_id: rawPost.external_item_id,
    source_url: rawPost.post_url,
    parent_item_id: null,
    actor_pseudonym: rawPost.account_pseudonym,
    content_text: rawPost.caption || '',
    published_at: toIso(rawPost.post_timestamp_iso),
    collected_at: toIso(rawPost.collected_at),
    media_count: Array.isArray(rawPost.media) ? rawPost.media.length : 0,
    engagement_hint: rawPost.engagement_hint || null,
    privacy_classification: 'PROTECTED_PRIVATE'
  };
}

function normalizeCommentItems(rawPost) {
  const postRootId = `ig_post_${rawPost.post_shortcode || rawPost.external_item_id || 'unknown'}`;
  const idMap = new Map();

  for (const comment of rawPost.comments || []) {
    const fallback = `${comment.timestamp_iso || 'ts'}_${comment.comment_pseudonym || 'anon'}_${comment.text || ''}`;
    const commentKey = comment.comment_id || fallback;
    idMap.set(comment.local_comment_id, `ig_comment_${rawPost.post_shortcode || 'post'}_${Buffer.from(commentKey).toString('hex').slice(0, 16)}`);
  }

  return (rawPost.comments || []).map((comment) => {
    const discourseId = idMap.get(comment.local_comment_id);
    const parentId = comment.parent_local_comment_id
      ? idMap.get(comment.parent_local_comment_id) || postRootId
      : postRootId;

    return {
      discourse_item_id: discourseId,
      platform: 'INSTAGRAM',
      item_type: 'COMMENT',
      external_item_id: comment.comment_id || null,
      source_url: rawPost.post_url,
      parent_item_id: parentId,
      actor_pseudonym: comment.comment_pseudonym,
      content_text: comment.text || '',
      published_at: toIso(comment.timestamp_iso),
      collected_at: toIso(rawPost.collected_at),
      like_count: typeof comment.like_count === 'number' ? comment.like_count : null,
      privacy_classification: 'PROTECTED_PRIVATE'
    };
  });
}

export function normalizePosts(rawPosts) {
  const discourseItems = [];
  const accountsByPseudonym = new Map();

  for (const rawPost of rawPosts) {
    discourseItems.push(normalizePostItem(rawPost));
    discourseItems.push(...normalizeCommentItems(rawPost));

    if (rawPost.account_pseudonym) {
      accountsByPseudonym.set(rawPost.account_pseudonym, {
        platform: 'INSTAGRAM',
        account_pseudonym: rawPost.account_pseudonym,
        account_role: 'POST_AUTHOR'
      });
    }

    for (const comment of rawPost.comments || []) {
      if (!comment.comment_pseudonym) continue;
      if (!accountsByPseudonym.has(comment.comment_pseudonym)) {
        accountsByPseudonym.set(comment.comment_pseudonym, {
          platform: 'INSTAGRAM',
          account_pseudonym: comment.comment_pseudonym,
          account_role: 'COMMENTER'
        });
      }
    }
  }

  return {
    discourseItems,
    accounts: Array.from(accountsByPseudonym.values())
  };
}