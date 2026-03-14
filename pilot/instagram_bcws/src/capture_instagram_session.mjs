import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT_DIR, 'secrets');
const STORAGE_STATE_PATH = path.join(SECRETS_DIR, 'instagram_storage_state.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isLoggedIn(context, page) {
  const cookies = await context.cookies('https://www.instagram.com');
  const hasSessionCookie = cookies.some((c) => c.name === 'sessionid' && c.value);
  if (hasSessionCookie) return true;

  try {
    const hasProfileHint = await page.locator('a[href="/accounts/edit/"]').first().isVisible({ timeout: 1000 });
    if (hasProfileHint) return true;
  } catch {
    // ignore
  }

  return false;
}

async function run() {
  await fs.mkdir(SECRETS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log('Opening Instagram login page...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('Log in in the opened browser window. Waiting up to 15 minutes for authenticated session...');

  const deadline = Date.now() + 15 * 60 * 1000;
  let loggedIn = false;

  while (Date.now() < deadline) {
    if (await isLoggedIn(context, page)) {
      loggedIn = true;
      break;
    }

    try {
      await page.waitForTimeout(2000);
    } catch {
      await sleep(2000);
    }
  }

  if (!loggedIn) {
    console.error('Timed out waiting for login. No storage state was written.');
    await browser.close();
    process.exit(1);
    return;
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Saved authenticated storage state to: ${STORAGE_STATE_PATH}`);

  await browser.close();
}

run().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exit(1);
});