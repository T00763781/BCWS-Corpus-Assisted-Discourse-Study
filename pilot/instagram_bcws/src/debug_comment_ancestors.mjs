import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const row = await page.evaluate(() => {
  const a = document.querySelector('a[href*="/p/"][href*="/c/"]');
  if (!a) return null;
  const levels = [];
  let node = a;
  for (let i = 0; i < 8 && node; i += 1) {
    const text = (node.innerText || '').trim();
    levels.push({
      level: i,
      tag: node.tagName,
      cls: (node.className || '').toString().slice(0, 80),
      lines: text.split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 12),
      len: text.length
    });
    node = node.parentElement;
  }
  return levels;
});
console.log(JSON.stringify(row, null, 2));
await browser.close();