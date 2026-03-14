import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const info = await page.evaluate((shortcode) => {
  const scripts = Array.from(document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]'));
  let foundIn = [];
  for (let i = 0; i < scripts.length; i += 1) {
    const txt = scripts[i].textContent || '';
    if (!txt) continue;
    if (txt.includes('xdt_shortcode_media')) foundIn.push({idx:i,kind:'xdt_shortcode_media',len:txt.length});
    if (txt.includes(shortcode || '')) foundIn.push({idx:i,kind:'shortcode',len:txt.length});
    if (txt.includes('edge_media_to_parent_comment')) foundIn.push({idx:i,kind:'edge_media_to_parent_comment',len:txt.length});
    if (txt.includes('edge_sidecar_to_children')) foundIn.push({idx:i,kind:'edge_sidecar_to_children',len:txt.length});
  }
  return {scriptCount:scripts.length,foundIn};
}, shortcode);

console.log(JSON.stringify(info, null, 2));
await browser.close();