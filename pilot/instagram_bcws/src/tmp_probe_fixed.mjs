import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const probe = await context.newPage();
await probe.goto('https://www.instagram.com/p/DRiTJUfkhtK/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await probe.waitForTimeout(4000);
const html = await probe.content();
const rx = /https:(?:\\\/|\\u002F|\/){2}[^"']+?\.mp4[^"']*/g;
const matches = html.match(rx) || [];
const decoded = matches
  .map((m) => m.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&'))
  .filter((u) => /^https?:\/\//i.test(u));
console.log('decoded', decoded.length);
console.log(decoded[0] || 'none');
await probe.close();
await browser.close();