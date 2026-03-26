import fs from 'node:fs';
import path from 'node:path';

type PlaywrightFallbackInput = {
  url: string;
  fireYear: number;
  incidentNumber: string;
  rawDir: string;
};

type PlaywrightFallbackOutput = {
  updates: string[];
  htmlPath: string | null;
  jsonArtifacts: string[];
  error: string | null;
};

function discoverBrowserExecutable(): string | null {
  const envPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function extractUpdatesFromText(text: string): string[] {
  const collapsed = text.replace(/\r/g, '');
  const out: string[] = [];
  const regex = /Response\s*Update[\s:\n]+([\s\S]{20,4000}?)(?=\n[A-Z][^\n]{2,80}\n|\nEvacuation|\nMap|\nResources|\nSuspected|\n$)/gi;
  for (const match of collapsed.matchAll(regex)) {
    const value = String(match[1] || '').replace(/\s+/g, ' ').trim();
    if (value.length >= 20) out.push(value);
  }
  return [...new Set(out)];
}

function collectCandidateStrings(input: unknown, pathKey = '', out: string[] = []): string[] {
  if (input === null || input === undefined) return out;
  if (typeof input === 'string') {
    const trimmed = input.replace(/\s+/g, ' ').trim();
    const keyMatch = /response|update|narrative|description|situation|detail/i.test(pathKey);
    if (trimmed.length >= 40 && (keyMatch || trimmed.toLowerCase().includes('response update'))) {
      out.push(trimmed);
    }
    return out;
  }
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      collectCandidateStrings(input[i], `${pathKey}[${i}]`, out);
    }
    return out;
  }
  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      collectCandidateStrings(value, pathKey ? `${pathKey}.${key}` : key, out);
    }
  }
  return out;
}

async function tryPlaywrightFallback(input: PlaywrightFallbackInput): Promise<PlaywrightFallbackOutput> {
  let playwright: typeof import('playwright-core') | null = null;
  try {
    playwright = await import('playwright-core');
  } catch {
    return { updates: [], htmlPath: null, jsonArtifacts: [], error: 'playwright-core not installed' };
  }

  const executablePath = discoverBrowserExecutable();
  if (!executablePath) {
    return { updates: [], htmlPath: null, jsonArtifacts: [], error: 'No Chromium/Edge executable found for Playwright fallback' };
  }

  let browser: import('playwright-core').Browser | null = null;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      executablePath,
      args: ['--disable-gpu', '--no-sandbox'],
    });

    const page = await browser.newPage();
    const responseCandidates: string[] = [];
    const jsonArtifacts: string[] = [];

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (!/wfnews-api/i.test(url)) return;
        const status = response.status();
        if (status !== 200) return;

        const contentType = response.headers()['content-type'] || '';
        if (!/application\/json/i.test(contentType)) return;

        const payload = await response.json();
        const candidates = collectCandidateStrings(payload);
        for (const value of candidates) {
          responseCandidates.push(value);
        }

        const safeName = `${input.fireYear}_${input.incidentNumber}_playwright_resp_${jsonArtifacts.length + 1}.json`.replace(
          /[^a-z0-9_.-]/gi,
          '_'
        );
        const jsonPath = path.join(input.rawDir, safeName);
        fs.writeFileSync(jsonPath, JSON.stringify({ url, payload }, null, 2), 'utf-8');
        jsonArtifacts.push(jsonPath);
      } catch {
        // Ignore single-response parse failures and continue extraction.
      }
    });

    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3500);

    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const domExtracted = await page.evaluate(() => {
      const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
      const out: string[] = [];
      const nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,strong,button,span,div,p'));
      for (const node of nodes) {
        const text = normalized((node as HTMLElement).innerText || node.textContent || '');
        if (!/response\s*update/i.test(text)) continue;
        let container: HTMLElement | null = node as HTMLElement;
        for (let hop = 0; hop < 5 && container; hop += 1) {
          const maybe = normalized(container.innerText || '');
          if (maybe.length > 40) {
            const cleaned = maybe.replace(/^response\s*update[:\s-]*/i, '').trim();
            if (cleaned.length > 30) out.push(cleaned);
            break;
          }
          container = container.parentElement;
        }
      }
      return Array.from(new Set(out));
    });
    const html = await page.content();
    const htmlPath = path.join(
      input.rawDir,
      `${input.fireYear}_${input.incidentNumber}_playwright.html`.replace(/[^a-z0-9_.-]/gi, '_')
    );
    fs.writeFileSync(htmlPath, html, 'utf-8');

    const updates = [...new Set([...extractUpdatesFromText(pageText), ...domExtracted, ...responseCandidates])];
    return { updates, htmlPath, jsonArtifacts, error: null };
  } catch (error) {
    return {
      updates: [],
      htmlPath: null,
      jsonArtifacts: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export const playwrightFallback = {
  tryPlaywrightFallback,
};
