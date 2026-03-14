import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveCanonicalPostUrl,
  describeMediaHealth,
  toBrowserMediaHref
} from '../review/ui_helpers.js';

test('deriveCanonicalPostUrl prefers canonical backend reel URLs and canonicalizes noisy paths', () => {
  assert.equal(
    deriveCanonicalPostUrl({
      post_shortcode: 'ABC123',
      post_url: 'https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link'
    }),
    'https://www.instagram.com/reel/ABC123/'
  );

  assert.equal(
    deriveCanonicalPostUrl({
      post_shortcode: 'DVrl69WAVeK',
      post_url: 'https://www.instagram.com/bcgovfireinfo/p/DVrl69WAVeK/?img_index=2'
    }),
    'https://www.instagram.com/p/DVrl69WAVeK/'
  );
});

test('toBrowserMediaHref produces robust browser-safe local paths', () => {
  assert.equal(
    toBrowserMediaHref('output/raw/media/manual extract/post 01.jpg'),
    '/output/raw/media/manual%20extract/post%2001.jpg'
  );
  assert.equal(
    toBrowserMediaHref('https://cdn.example.com/video.mp4'),
    'https://cdn.example.com/video.mp4'
  );
});

test('describeMediaHealth surfaces the UI/API media health contract fields', () => {
  const health = describeMediaHealth({
    media_sync_status: 'PRESERVED_PARTIAL',
    media_saved_count: 3,
    media_failed_count: 2,
    media_guard_reason: 'incoming_media_incomplete'
  });

  assert.deepEqual(health, {
    status: 'PRESERVED_PARTIAL',
    savedCount: 3,
    failedCount: 2,
    guardReason: 'incoming_media_incomplete'
  });
});
