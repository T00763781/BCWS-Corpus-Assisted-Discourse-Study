import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const rows = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/p/"][href*="/c/"]')).slice(0, 8);
  return anchors.map((a) => ({
    href: a.getAttribute('href'),
    text: (a.textContent || '').trim(),
    parentHtml: (a.closest('div')?.outerHTML || '').slice(0, 1600)
  }));
});

console.log(JSON.stringify(rows, null, 2));
await browser.close();