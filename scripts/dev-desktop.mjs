import { execFile, spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 5173;
const argv = new Set(process.argv.slice(2));
const SMOKE_MODE = process.env.OF_SMOKE === '1' || argv.has('--smoke');
const CONFIGURED_PORT = readPort(process.env.OF_DEV_PORT);
const REQUESTED_PORT = CONFIGURED_PORT ?? DEFAULT_PORT;

function readPort(value) {
  if (value == null || String(value).trim() === '') return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`OF_DEV_PORT must be an integer between 1 and 65535. Received: ${value}`);
  }
  return port;
}

function spawnCmd(command, args, extraEnv = {}) {
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(([, value]) => value != null)
  );
  return spawn(getCommand(command), args, {
    stdio: 'inherit',
    shell: false,
    env,
  });
}

function getCommand(command) {
  return command;
}

function getViteCommand() {
  return process.execPath;
}

function getViteArgs(port) {
  return [path.resolve('node_modules/vite/bin/vite.js'), '--host', HOST, '--port', String(port), '--strictPort'];
}

function getElectronCommand() {
  if (process.platform === 'win32') {
    return path.resolve('node_modules/electron/dist/electron.exe');
  }
  if (process.platform === 'darwin') {
    return path.resolve('node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  }
  return path.resolve('node_modules/electron/dist/electron');
}

function getElectronArgs() {
  return [path.resolve('electron/main.mjs')];
}

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function isPortFree(port, host = HOST) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(true);
      });
    });
    server.listen(port, host);
  });
}

async function findListeningPid(port) {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp']);
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (!match) continue;
      const [, , localPort, pid] = match;
      if (Number(localPort) === port) {
        return Number(pid);
      }
    }
    return null;
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
    const pid = Number(stdout.split(/\r?\n/).find(Boolean));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function killPid(pid, reason) {
  if (!pid || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch (error) {
    if (!(await isPidRunning(pid))) return;
    throw error;
  }
  await waitForPidExit(pid, reason);
}

async function waitForPidExit(pid, reason, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const stillRunning = await isPidRunning(pid);
    if (!stillRunning) return;
    await delay(150);
  }
  throw new Error(`${reason} did not exit within ${timeoutMs}ms (pid ${pid}).`);
}

async function isPidRunning(pid) {
  if (!pid) return false;
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FI', `PID eq ${pid}`]);
    return stdout.includes(String(pid));
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopChild(child, reason) {
  if (!child?.pid || child.exitCode !== null) return;
  await killPid(child.pid, reason);
}

async function choosePort() {
  if (await isPortFree(REQUESTED_PORT)) {
    return REQUESTED_PORT;
  }

  if (CONFIGURED_PORT != null) {
    const pid = await findListeningPid(CONFIGURED_PORT);
    if (!pid) {
      throw new Error(`Configured dev port ${CONFIGURED_PORT} is busy but no owning PID could be determined.`);
    }
    console.error(`Port ${CONFIGURED_PORT} is occupied by pid ${pid}. Terminating only that process before launch.`);
    await killPid(pid, `Process on configured port ${CONFIGURED_PORT}`);
    if (!(await isPortFree(CONFIGURED_PORT))) {
      throw new Error(`Configured dev port ${CONFIGURED_PORT} is still unavailable after terminating pid ${pid}.`);
    }
    return CONFIGURED_PORT;
  }

  const freePort = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
    server.listen(0, HOST);
  });

  console.error(`Port ${REQUESTED_PORT} is occupied. Launching Vite on alternate free port ${freePort}.`);
  return freePort;
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

function validateLaunchEnv() {
  if (!SMOKE_MODE) return;
  const screenshotDir = process.env.OF_SCREENSHOT_DIR?.trim();
  if (!screenshotDir) {
    throw new Error(
      'Smoke mode requires OF_SCREENSHOT_DIR to be set to a writable directory. Refusing to launch a broken run.'
    );
  }
}

let electron;
let vite;
let shuttingDown = false;

const cleanup = async () => {
  shuttingDown = true;
  await stopChild(electron, 'Electron process for this run');
  await stopChild(vite, 'Vite process for this run');
};

process.on('SIGINT', () => {
  cleanup().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  cleanup().finally(() => process.exit(0));
});

try {
  validateLaunchEnv();
  const port = await choosePort();
  const devServerUrl = `http://${HOST}:${port}`;
  vite = spawnCmd(getViteCommand(), getViteArgs(port), {
    BROWSER: 'none',
  });

  vite.on('exit', (code) => {
    if (shuttingDown) return;
    if (code !== 0) process.exit(code || 1);
  });

  await waitForServer(devServerUrl);
  electron = spawnCmd(getElectronCommand(), getElectronArgs(), {
    OF_SMOKE: SMOKE_MODE ? '1' : process.env.OF_SMOKE,
    OF_DEV_PORT: String(port),
    VITE_DEV_SERVER_URL: devServerUrl,
  });

  electron.on('exit', (code) => {
    cleanup().finally(() => process.exit(code || 0));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await cleanup();
  process.exit(1);
}
