import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const OUTPUT_RAW_DIR = path.join(ROOT_DIR, 'output', 'raw');
export const OUTPUT_MEDIA_DIR = path.join(OUTPUT_RAW_DIR, 'media');

export async function loadDotEnv(dotEnvPath = path.join(ROOT_DIR, '.env')) {
  try {
    const raw = await fs.readFile(dotEnvPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

export function resolveMaybeRelativePath(maybePath) {
  if (!maybePath) return null;
  if (path.isAbsolute(maybePath)) return maybePath;
  return path.resolve(ROOT_DIR, maybePath);
}

export function getConfig() {
  const cfg = {
    databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/instagram_research',
    identitySecret: process.env.IDENTITY_HMAC_SECRET || '',
    storageStatePath: resolveMaybeRelativePath(process.env.IG_SESSION_STATE_PATH || ''),
    headless: process.env.HEADLESS !== '0',
    navMaxRetries: Number(process.env.NAV_MAX_RETRIES || 3),
    commentExpansionMaxSteps: Number(process.env.COMMENT_EXPANSION_MAX_STEPS || 400),
    profileDiscoveryMaxScrolls: Number(process.env.PROFILE_DISCOVERY_MAX_SCROLLS || 80),
    profileDiscoveryIdleRounds: Number(process.env.PROFILE_DISCOVERY_IDLE_ROUNDS || 6),
    ingestCutoffDate: process.env.INGEST_CUTOFF_DATE || '2025-04-01T00:00:00Z',
    parserVersion: process.env.PARSER_VERSION || 'v2-account-sync',
    reviewUiPort: Number(process.env.REVIEW_UI_PORT || 4173)
  };

  if (!cfg.identitySecret) {
    throw new Error('Missing IDENTITY_HMAC_SECRET.');
  }
  if (!cfg.storageStatePath) {
    throw new Error('Missing IG_SESSION_STATE_PATH.');
  }

  return cfg;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetries(fn, retries, label) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < retries) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      const waitMs = attempt * 1200;
      console.warn(`[retry] ${label} failed on attempt ${attempt}/${retries}: ${err.message}. Retrying in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}
