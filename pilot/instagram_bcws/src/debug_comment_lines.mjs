import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const rows = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/p/"][href*="/c/"]')).slice(0, 5);
  return anchors.map((a) => {
    const block = a.closest('div');
    const text = (block?.innerText || '').trim();
    return {
      href: a.getAttribute('href'),
      time: (a.textContent || '').trim(),
      lines: text.split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 12)
    };
  });
});

console.log(JSON.stringify(rows, null, 2));
await browser.close();