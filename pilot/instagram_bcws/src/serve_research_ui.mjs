import http from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { loadDotEnv, getConfig, ROOT_DIR } from './lib/config.mjs';
import {
  addMonitoredAccount,
  createDbPool,
  deactivateMonitoredAccount,
  getPostDetail,
  getPosts,
  getRuns,
  listMonitoredAccounts,
  runSchemaMigration
} from './lib/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4'
};

let currentSync = null;

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function safeResolveStatic(urlPath) {
  const cleaned = decodeURIComponent((urlPath || '/').split('?')[0]);
  const relative = cleaned === '/' ? '/review/index.html' : cleaned;
  const abs = path.resolve(ROOT_DIR, `.${relative}`);
  if (!abs.startsWith(ROOT_DIR)) return null;
  return abs;
}

function runSyncCommand(accountHandle, trigger = 'manual_click') {
  if (currentSync) {
    return Promise.resolve({ ok: false, reason: 'Sync already running', pid: currentSync.pid });
  }

  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'sync_accounts.mjs');
    const args = [scriptPath, '--trigger', trigger];
    if (accountHandle) {
      args.push('--account', accountHandle);
    }

    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (buf) => { stdout += String(buf); });
    child.stderr.on('data', (buf) => { stderr += String(buf); });

    currentSync = { pid: child.pid, started_at: new Date().toISOString(), account: accountHandle || null };

    child.on('close', (code) => {
      const done = {
        ok: code === 0,
        exit_code: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
      currentSync = null;
      resolve(done);
    });
  });
}

async function start() {
  await loadDotEnv();
  const cfg = getConfig();
  const pool = createDbPool(cfg.databaseUrl);
  await runSchemaMigration(pool);

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (reqUrl.pathname === '/api/health') {
        sendJson(res, 200, { ok: true, sync_running: Boolean(currentSync), sync: currentSync });
        return;
      }

      if (reqUrl.pathname === '/api/accounts' && req.method === 'GET') {
        const rows = await listMonitoredAccounts(pool);
        sendJson(res, 200, { items: rows });
        return;
      }

      if (reqUrl.pathname === '/api/accounts' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const handle = String(body.handle || '').trim();
        if (!handle) {
          sendJson(res, 400, { error: 'handle is required' });
          return;
        }

        const added = await addMonitoredAccount(pool, handle);
        const backfill = body.backfill !== false;
        let syncResult = null;
        if (backfill) {
          syncResult = await runSyncCommand(added.handle, 'account_added_backfill');
        }
        sendJson(res, 200, { account: added, backfill_triggered: backfill, sync_result: syncResult });
        return;
      }

      if (reqUrl.pathname.startsWith('/api/accounts/') && req.method === 'DELETE') {
        const handle = decodeURIComponent(reqUrl.pathname.split('/').pop() || '');
        const removed = await deactivateMonitoredAccount(pool, handle);
        if (!removed) {
          sendJson(res, 404, { error: 'account not found' });
          return;
        }
        sendJson(res, 200, { ok: true, handle: removed.handle });
        return;
      }

      if (reqUrl.pathname === '/api/sync' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const handle = body.account ? String(body.account).trim().toLowerCase().replace(/^@+/, '') : null;
        const result = await runSyncCommand(handle, 'manual_click');
        sendJson(res, 200, result);
        return;
      }

      if (reqUrl.pathname === '/api/runs' && req.method === 'GET') {
        const limit = Number(reqUrl.searchParams.get('limit') || 30);
        const rows = await getRuns(pool, limit);
        sendJson(res, 200, { items: rows, sync_running: Boolean(currentSync), sync: currentSync });
        return;
      }

      if (reqUrl.pathname === '/api/posts' && req.method === 'GET') {
        const account = reqUrl.searchParams.get('account') || null;
        const since = reqUrl.searchParams.get('since') || null;
        const limit = Number(reqUrl.searchParams.get('limit') || 100);
        const rows = await getPosts(pool, { accountHandle: account, sinceIso: since, limit });
        sendJson(res, 200, { items: rows });
        return;
      }

      if (reqUrl.pathname.startsWith('/api/posts/') && req.method === 'GET') {
        const postId = decodeURIComponent(reqUrl.pathname.split('/').pop() || '');
        const detail = await getPostDetail(pool, postId);
        if (!detail) {
          sendJson(res, 404, { error: 'post not found' });
          return;
        }
        sendJson(res, 200, detail);
        return;
      }

      const absPath = safeResolveStatic(reqUrl.pathname);
      if (!absPath) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      try {
        const stat = await fs.stat(absPath);
        const filePath = stat.isDirectory() ? path.join(absPath, 'index.html') : absPath;
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
        createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(404).end('Not found');
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message || String(err) });
    }
  });

  server.listen(cfg.reviewUiPort, () => {
    console.log(`Research UI: http://localhost:${cfg.reviewUiPort}/review/`);
  });
}

start().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exitCode = 1;
});
