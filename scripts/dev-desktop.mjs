import { spawn } from 'node:child_process';
import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = Number(process.env.OF_DEV_PORT || 5173);
const DEV_SERVER_URL = `http://${HOST}:${PORT}`;
const SMOKE_MODE = process.env.OF_SMOKE === '1';

function spawnCmd(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
}

function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for Vite at ${url}`));
        return;
      }
      setTimeout(attempt, 300);
    };

    attempt();
  });
}

const vite = spawnCmd('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT), '--strictPort']);
let electron;

const cleanup = () => {
  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
};

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

vite.on('exit', (code) => {
  if (code !== 0) process.exit(code || 1);
});

try {
  await waitForServer(DEV_SERVER_URL);
  electron = spawnCmd('npx', ['electron', 'electron/main.mjs'], {
    VITE_DEV_SERVER_URL: DEV_SERVER_URL,
  });

  if (SMOKE_MODE) {
    setTimeout(() => {
      if (electron && !electron.killed) {
        electron.kill();
      }
    }, 15000);
  }

  electron.on('exit', (code) => {
    if (!vite.killed) vite.kill();
    process.exit(code || 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  cleanup();
  process.exit(1);
}
