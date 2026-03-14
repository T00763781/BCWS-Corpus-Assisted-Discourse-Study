import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DRiTJUfkhtK/';

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
    if (!txt) return;
    let keys = [];
    try {
      const j = JSON.parse(txt);
      if (j && typeof j === 'object') keys = Object.keys(j).slice(0,20);
    } catch {}
    hits.push({url:u.slice(0,260),len:txt.length,keys,sample:txt.slice(0,120)});
  } catch {}
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(10000);

console.log(JSON.stringify(hits.slice(0,80), null, 2));
await browser.close();