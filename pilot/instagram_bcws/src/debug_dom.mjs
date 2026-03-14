import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const root = document.querySelector('main') || document;
  const anchorRows = Array.from(root.querySelectorAll('a[href]')).slice(0, 60).map((a) => ({
    href: a.getAttribute('href'),
    text: (a.textContent || '').trim()
  }));

  const scriptRows = Array.from(document.querySelectorAll('script')).map((s) => ({
    type: s.getAttribute('type') || '',
    id: s.getAttribute('id') || '',
    len: (s.textContent || '').length
  })).slice(0, 50);

  return {
    url: location.href,
    title: document.title,
    timeCount: root.querySelectorAll('time').length,
    liCount: root.querySelectorAll('li').length,
    anchorRows,
    scriptRows,
    textPreview: (root.innerText || '').slice(0, 2500)
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();