import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

const data = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button, a, div[role="button"], span, div'));
  const hits = nodes
    .map((n) => ({
      tag: n.tagName,
      role: n.getAttribute('role') || '',
      aria: n.getAttribute('aria-label') || '',
      text: (n.textContent || '').trim(),
      cls: String(n.className || '').slice(0, 80)
    }))
    .filter((x) => /(next|slide|\d+\s*of\s*\d+|\d+\s*\/\s*\d+)/i.test(`${x.aria} ${x.text}`))
    .slice(0, 200);
  return hits;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();