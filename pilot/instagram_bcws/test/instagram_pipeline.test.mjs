import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendUniqueMediaItem,
  canApplyPostLevelVideoFallback,
  decideMediaReplacement,
  extractShortcodeFromUrl,
  normalizeInstagramPostUrl,
  summarizeMediaManifest
} from '../src/lib/instagram_common.mjs';
import { upsertPostCaptureAndResearch } from '../src/lib/db.mjs';

test('normalizeInstagramPostUrl keeps only canonical /p/ and /reel/ targets', () => {
  assert.equal(
    normalizeInstagramPostUrl('https://www.instagram.com/p/ABC123/?img_index=2'),
    'https://www.instagram.com/p/ABC123/'
  );
  assert.equal(
    normalizeInstagramPostUrl('/reel/xyz_09/?utm_source=ig_web_copy_link'),
    'https://www.instagram.com/reel/xyz_09/'
  );
  assert.equal(normalizeInstagramPostUrl('/p/ABC123/c/18000/'), null);
  assert.equal(normalizeInstagramPostUrl('/stories/example/1/'), null);
  assert.equal(extractShortcodeFromUrl('https://www.instagram.com/reel/xyz_09/'), 'xyz_09');
});

test('appendUniqueMediaItem preserves carousel order and deduplicates repeated slide captures', () => {
  const media = [];
  const seen = new Set();

  assert.equal(appendUniqueMediaItem(media, seen, {
    media_type: 'IMAGE',
    media_url: 'https://cdn.example.com/v/t51.82787-15/slide_01.jpg?foo=1'
  }), true);
  assert.equal(appendUniqueMediaItem(media, seen, {
    media_type: 'IMAGE',
    media_url: 'https://cdn.example.com/v/t51.82787-15/slide_02.jpg?foo=1'
  }), true);
  assert.equal(appendUniqueMediaItem(media, seen, {
    media_type: 'IMAGE',
    media_url: 'https://cdn.example.com/v/t51.82787-15/slide_01.jpg?foo=2'
  }), false);

  assert.deepEqual(media.map((item) => item.media_url), [
    'https://cdn.example.com/v/t51.82787-15/slide_01.jpg?foo=1',
    'https://cdn.example.com/v/t51.82787-15/slide_02.jpg?foo=1'
  ]);
});

test('post-level video fallback only applies to a single poster-only media item', () => {
  assert.equal(canApplyPostLevelVideoFallback([{ media_type: 'VIDEO_POSTER_ONLY' }]), true);
  assert.equal(canApplyPostLevelVideoFallback([
    { media_type: 'VIDEO_POSTER_ONLY' },
    { media_type: 'VIDEO_POSTER_ONLY' }
  ]), false);
  assert.equal(canApplyPostLevelVideoFallback([{ media_type: 'VIDEO' }]), false);
});

test('decideMediaReplacement blocks destructive partial overwrites', () => {
  const existing = [
    { local_path: 'one.jpg', sha256: 'a' },
    { local_path: 'two.jpg', sha256: 'b' },
    { local_path: 'three.mp4', sha256: 'c' }
  ];
  const incoming = [
    { local_path: 'one.jpg', sha256: 'a' },
    { local_path: null, sha256: null, download_status: 'FAILED' }
  ];

  const decision = decideMediaReplacement(existing, incoming);
  assert.equal(decision.replace, false);
  assert.equal(decision.reason, 'incoming_media_incomplete');
});

test('summarizeMediaManifest distinguishes complete and partial persistence', () => {
  assert.deepEqual(
    summarizeMediaManifest([
      { local_path: 'one.jpg', sha256: 'a', download_status: 'SAVED' },
      { local_path: 'two.mp4', sha256: 'b', download_status: 'SAVED' }
    ]),
    {
      status: 'COMPLETE',
      total_count: 2,
      saved_count: 2,
      failed_count: 0,
      pending_count: 0
    }
  );

  assert.deepEqual(
    summarizeMediaManifest([
      { local_path: 'one.jpg', sha256: 'a', download_status: 'SAVED' },
      { local_path: null, sha256: null, download_status: 'FAILED' }
    ]),
    {
      status: 'PARTIAL',
      total_count: 2,
      saved_count: 1,
      failed_count: 1,
      pending_count: 0
    }
  );
});

test('upsertPostCaptureAndResearch preserves prior media rows when incoming scrape is partial', async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('SELECT media_index, media_type, media_url')) {
        return {
          rows: [
            { media_index: 1, media_type: 'IMAGE', media_url: 'https://cdn.example.com/one.jpg', local_path: 'one.jpg', sha256: 'a' },
            { media_index: 2, media_type: 'VIDEO', media_url: 'https://cdn.example.com/two.mp4', local_path: 'two.mp4', sha256: 'b' }
          ]
        };
      }
      return { rows: [], rowCount: 0 };
    }
  };

  const result = await upsertPostCaptureAndResearch(pool, {
    runId: 1,
    parserVersion: 'test',
    accountHandle: 'bcgovfireinfo',
    accountPseudonym: 'acct',
    postRecord: {
      collected_at: '2026-03-14T00:00:00.000Z',
      post_shortcode: 'ABC123',
      external_item_id: 'ABC123',
      post_url: 'https://www.instagram.com/p/ABC123/',
      caption: '',
      engagement_hint: null,
      post_timestamp_iso: '2026-03-14T00:00:00.000Z',
      media: [
        { media_type: 'IMAGE', media_url: 'https://cdn.example.com/one.jpg', local_path: 'one.jpg', sha256: 'a', download_status: 'SAVED' },
        { media_type: 'VIDEO', media_url: 'https://cdn.example.com/two.mp4', local_path: null, sha256: null, download_status: 'FAILED' }
      ],
      comments: []
    },
    normalizedComments: [],
    normalizedAccounts: []
  });

  assert.equal(result.mediaSyncStatus, 'PRESERVED_PARTIAL');
  assert.equal(queries.some((sql) => sql.includes('DELETE FROM research.post_media')), false);
});
