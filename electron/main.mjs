import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createDbLifecycleManager } from './db-lifecycle.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);
const CAPTURE_DIR = process.env.OF_SCREENSHOT_DIR;
const SMOKE_MODE = process.env.OF_SMOKE === '1';
const PHASE4_AUTO_CAPTURE = process.env.OF_PHASE4_AUTO_CAPTURE === '1';
const PHASE4C_AUTO_RECOVER = process.env.OF_PHASE4C_AUTO_RECOVER === '1';
const PHASE4D_AUTO_VERIFY = process.env.OF_PHASE4D_AUTO_VERIFY === '1';
const PHASE4G_AUTO_VERIFY = process.env.OF_PHASE4G_AUTO_VERIFY === '1';
const EXTRA_INCIDENT_CAPTURE_ROUTE = process.env.OF_CAPTURE_INCIDENT_ROUTE || '';
const SHOULD_CONTINUE_AFTER_AUTO_CAPTURE = PHASE4C_AUTO_RECOVER || PHASE4D_AUTO_VERIFY || PHASE4G_AUTO_VERIFY;
const dbLifecycle = createDbLifecycleManager({ app, dialog, BrowserWindow });
let autoCheckTimer = null;

function createWindow() {
  return new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#050713',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}

async function loadRenderer(win, hash = '#/dashboard') {
  if (IS_DEV) {
    const url = `${DEV_SERVER_URL}/?desktop=${Date.now()}${hash}`;
    await win.loadURL(url);
    return;
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  await win.loadFile(indexPath);
  await win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(hash)};`, true);
}

async function captureView(win, hash, fileName) {
  if (!CAPTURE_DIR) return;
  await loadRenderer(win, hash);
  await captureCurrentView(win, fileName, 900);
}

async function captureCurrentView(win, fileName, waitMs = 900) {
  if (!CAPTURE_DIR) return;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  let png = Buffer.alloc(0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const image = await win.webContents.capturePage();
    png = image.toPNG();
    if (png.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE_DIR, fileName), png);
}

async function captureIncidentTab(win, hash, tabLabel, fileName, waitMs = 1500) {
  if (!CAPTURE_DIR) return;
  await loadRenderer(win, hash);
  await win.webContents.executeJavaScript(
    `
      (async () => {
        const started = Date.now();
        while (Date.now() - started < 15000) {
          const button = [...document.querySelectorAll('button')].find(
            (item) => item.textContent && item.textContent.trim() === ${JSON.stringify(tabLabel)}
          );
          if (button) {
            button.click();
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return false;
      })();
    `,
    true
  );
  await captureCurrentView(win, fileName, waitMs);
}

function restartAutoCheckTimer() {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer);
    autoCheckTimer = null;
  }
  const status = dbLifecycle.getStatus();
  const intervalMinutes = Number(status.autoCheckMinutes || 0);
  if (!status.hasActiveDb || intervalMinutes <= 0) return;
  const tickMs = Math.max(60_000, intervalMinutes * 60_000);
  autoCheckTimer = setInterval(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('db:auto-check-tick', {
          intervalMinutes,
          triggeredAt: nowIso(),
        });
      }
    }
  }, tickMs);
}

function nowIso() {
  return new Date().toISOString();
}

app.whenReady().then(async () => {
  if (SMOKE_MODE) {
    const smokeTimeoutMs = PHASE4_AUTO_CAPTURE ? 1800000 : 25000;
    setTimeout(() => app.quit(), smokeTimeoutMs);
  }

  await dbLifecycle.autoLoadLastUsed();

  if (process.env.OF_DB_CREATE_PATH) {
    await dbLifecycle.createDbAtPath(process.env.OF_DB_CREATE_PATH);
  }
  if (process.env.OF_DB_SELECT_PATH) {
    await dbLifecycle.selectDbAtPath(process.env.OF_DB_SELECT_PATH);
  }
  if (process.env.OF_DB_DELETE_ACTIVE === '1') {
    await dbLifecycle.deleteActiveDb();
  }
  if (process.env.OF_SET_AUTOCHECK_MINUTES) {
    dbLifecycle.setAutoCheckMinutes(process.env.OF_SET_AUTOCHECK_MINUTES);
  }
  restartAutoCheckTimer();

  ipcMain.handle('db:get-status', async () => dbLifecycle.getStatus());
  ipcMain.handle('db:create', async () => {
    const result = await dbLifecycle.createNewDb();
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:select', async () => {
    const result = await dbLifecycle.chooseExistingDb();
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:delete-active', async () => {
    const result = await dbLifecycle.deleteActiveDb();
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:create-at-path', async (_event, dbPath) => {
    const result = await dbLifecycle.createDbAtPath(dbPath);
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:select-path', async (_event, dbPath) => {
    const result = await dbLifecycle.selectDbAtPath(dbPath);
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:set-auto-check-minutes', async (_event, minutes) => {
    const result = dbLifecycle.setAutoCheckMinutes(minutes);
    restartAutoCheckTimer();
    return result;
  });
  ipcMain.handle('db:get-capture-metrics', async () => dbLifecycle.getCaptureMetrics());
  ipcMain.handle('db:get-capture-summary', async () => dbLifecycle.getCaptureCompletenessSummary());
  ipcMain.handle('db:get-capture-targets', async () => dbLifecycle.getIncidentCaptureTargets());
  ipcMain.handle('db:recover-response-history', async () => dbLifecycle.recoverResponseHistoryFromArchivedRaw());
  ipcMain.handle('db:capture-mark-running', async () => dbLifecycle.markCaptureRunning());
  ipcMain.handle('db:capture-mark-error', async (_event, message) => dbLifecycle.markCaptureError(message));
  ipcMain.handle('db:capture-save', async (_event, payload) => dbLifecycle.saveIncidentCapture(payload));
  ipcMain.handle('db:incidents-list-local', async () => dbLifecycle.getIncidentListLocal());
  ipcMain.handle('db:incident-detail-local', async (_event, fireYear, incidentNumber) =>
    dbLifecycle.getIncidentDetailLocal(fireYear, incidentNumber)
  );

  const win = createWindow();
  await loadRenderer(win);

  if (PHASE4_AUTO_CAPTURE) {
    await captureView(win, '#/configure', 'phase4b-settings-before-capture.png');
    await win.webContents.executeJavaScript(
      `
        (async () => {
          const started = Date.now();
          while (Date.now() - started < 20000) {
            const button = [...document.querySelectorAll('button')].find(
              (item) => item.textContent && item.textContent.trim() === 'Capture incidents'
            );
            if (button && !button.disabled) {
              button.click();
              return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          return false;
        })();
      `,
      true
    );
    await win.webContents.executeJavaScript(
      `
        (async () => {
          const started = Date.now();
          while (Date.now() - started < 1800000) {
            const summary = [...document.querySelectorAll('.list-results-label')].some(
              (node) => node.textContent && node.textContent.includes('Captured ')
            );
            const failed = Boolean(document.querySelector('.error-banner'));
            if (summary || failed) return summary;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          return false;
        })();
      `,
      true
    );
    await captureView(win, '#/configure', 'phase4b-settings-after-capture.png');
    await captureView(win, '#/incidents', 'phase4b-incidents-after-capture.png');
    await loadRenderer(win, '#/incidents/2025/G70422');
    await captureCurrentView(win, 'phase4b-g70422-after-capture.png', 4000);
    if (SMOKE_MODE) {
      app.quit();
      return;
    }
    await loadRenderer(win, '#/dashboard');
  }

  if (PHASE4D_AUTO_VERIFY) {
    await captureView(win, '#/configure', 'phase4d-settings-after-capture.png');
    await loadRenderer(win, '#/incidents/2025/G70422');
    await captureCurrentView(win, 'phase4d-g70422-detail.png', 4000);
    await captureIncidentTab(win, '#/incidents/2025/G70422', 'Gallery', 'phase4d-g70422-gallery.png', 2500);
    await captureIncidentTab(win, '#/incidents/2025/G70422', 'Response', 'phase4d-g70422-response.png', 2500);
    if (EXTRA_INCIDENT_CAPTURE_ROUTE) {
      await loadRenderer(win, EXTRA_INCIDENT_CAPTURE_ROUTE);
      await captureCurrentView(win, 'phase4d-second-incident-detail.png', 4000);
    }
    if (SMOKE_MODE) {
      app.quit();
      return;
    }
    await loadRenderer(win, '#/dashboard');
  }

  if (PHASE4G_AUTO_VERIFY) {
    await captureView(win, '#/configure', 'phase4g-settings-after-capture.png');
    await captureIncidentTab(win, '#/incidents/2025/G70422', 'Gallery', 'phase4g-g70422-gallery.png', 2500);
    if (EXTRA_INCIDENT_CAPTURE_ROUTE) {
      await captureIncidentTab(win, EXTRA_INCIDENT_CAPTURE_ROUTE, 'Gallery', 'phase4g-second-incident-gallery.png', 2500);
    }
    if (SMOKE_MODE && !SHOULD_CONTINUE_AFTER_AUTO_CAPTURE) {
      app.quit();
      return;
    }
    await loadRenderer(win, '#/dashboard');
  }

  if (PHASE4C_AUTO_RECOVER) {
    await captureView(win, '#/configure', 'phase4c-settings-before-recovery.png');
    await dbLifecycle.recoverResponseHistoryFromArchivedRaw();
    await captureView(win, '#/configure', 'phase4c-settings-after-recovery.png');
    await loadRenderer(win, '#/incidents/2025/G70422');
    await captureCurrentView(win, 'phase4c-g70422-after-recovery.png', 3000);
    if (SMOKE_MODE) {
      app.quit();
      return;
    }
    await loadRenderer(win, '#/dashboard');
  }

  if (CAPTURE_DIR) {
    await captureView(win, '#/configure', 'phase2-desktop-settings.png');
    await captureView(win, '#/dashboard', 'phase2-desktop-dashboard.png');
    if (EXTRA_INCIDENT_CAPTURE_ROUTE) {
      await captureView(win, EXTRA_INCIDENT_CAPTURE_ROUTE, 'phase4d-second-incident-detail.png');
    }
    if (SMOKE_MODE) {
      app.quit();
      return;
    }
    await loadRenderer(win, '#/dashboard');
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createWindow();
      await loadRenderer(next);
    }
  });
});

app.on('window-all-closed', () => {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer);
    autoCheckTimer = null;
  }
  dbLifecycle.closeActive();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
