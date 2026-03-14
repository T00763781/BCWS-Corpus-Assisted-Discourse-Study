import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DRiTJUfkhtK/';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();

const hits = [];
page.on('response', async (res) => {
  const ct = (res.headers()['content-type'] || '').toLowerCase();
  if (!ct.includes('application/json')) return;
  const u = res.url();
  try {
    const txt = await res.text();
    if (!txt || !txt.includes(shortcode)) return;
    const flags = [];
    if (txt.includes('video_url')) flags.push('video_url');
    if (txt.includes('edge_sidecar_to_children')) flags.push('sidecar');
    if (txt.includes('display_url')) flags.push('display_url');
    if (txt.includes('xdt_shortcode_media')) flags.push('xdt_shortcode_media');
    if (flags.length) {
      hits.push({url:u.slice(0,220),len:txt.length,flags,sample:txt.slice(0,180)});
    }
  } catch {}
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(10000);

console.log(JSON.stringify(hits.slice(0,30), null, 2));
await browser.close();