import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);

const out = await page.evaluate((shortcode) => {
  const anchors = Array.from(document.querySelectorAll(`a[href*="/p/${shortcode}/"]`));
  const rows = anchors.slice(0,80).map(a => ({
    href: a.getAttribute('href'),
    hasImg: !!a.querySelector('img'),
    hasVideo: !!a.querySelector('video'),
    imgSrc: a.querySelector('img')?.currentSrc || a.querySelector('img')?.getAttribute('src') || null,
    videoSrc: a.querySelector('video')?.currentSrc || a.querySelector('video')?.getAttribute('src') || null,
    text: (a.textContent||'').trim().slice(0,80)
  }));

  const imgs = Array.from(document.querySelectorAll('img')).map(i => i.currentSrc || i.getAttribute('src') || '').filter(Boolean);
  const vids = Array.from(document.querySelectorAll('video')).map(v => v.currentSrc || v.getAttribute('src') || '').filter(Boolean);

  return {
    anchorCount: anchors.length,
    rows,
    imgCount: imgs.length,
    vidCount: vids.length,
    imgSamples: imgs.slice(0,20),
    vidSamples: vids.slice(0,20)
  };
}, shortcode);

console.log(JSON.stringify(out, null, 2));
await browser.close();