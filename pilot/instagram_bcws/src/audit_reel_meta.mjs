import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DRiTJUfkhtK/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const data = await page.evaluate(() => ({
  ogVideo: document.querySelector('meta[property="og:video"]')?.getAttribute('content') || null,
  ogVideoSecure: document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content') || null,
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
  ld: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent || '').slice(0,2)
}));

console.log(JSON.stringify(data, null, 2));
await browser.close();