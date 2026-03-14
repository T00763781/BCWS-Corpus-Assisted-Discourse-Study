import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto('https://www.instagram.com/p/DRiTJUfkhtK/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const html = await page.content();
const rx = new RegExp('https:\\\\/\\\\/[^\\"\']+\\.mp4[^\\"\']*', 'g');
const matches = html.match(rx) || [];
console.log('count', matches.length);
console.log(matches[0] ? matches[0].slice(0, 180) : 'none');
await browser.close();