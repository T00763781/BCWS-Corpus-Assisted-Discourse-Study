import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DRiTJUfkhtK/';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();

const hits = [];
page.on('response', async (res) => {
  const u = res.url();
  try {
    const txt = await res.text();
    if (!txt) return;
    if (u.includes('graphql/query')) {
      let has=false;
      if (txt.includes(shortcode)) has=true;
      if (txt.includes('/p/')) has=true;
      if (txt.includes('xdt_api__v1__feed__timeline__connection')) has=true;
      if (has) {
        hits.push({
          url:u,
          len:txt.length,
          hasShortcode:txt.includes(shortcode),
          idxShortcode:txt.indexOf(shortcode),
          idxPermalink:txt.indexOf('/p/'),
          sample:txt.slice(Math.max(0,txt.indexOf('/p/')-80), Math.max(0,txt.indexOf('/p/')-80)+260)
        });
      }
    }
  } catch {}
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(10000);

console.log(JSON.stringify(hits, null, 2));
await browser.close();