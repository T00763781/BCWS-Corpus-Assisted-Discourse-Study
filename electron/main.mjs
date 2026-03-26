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
const dbLifecycle = createDbLifecycleManager({ app, dialog, BrowserWindow });

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
  await new Promise((resolve) => setTimeout(resolve, 900));
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

app.whenReady().then(async () => {
  if (SMOKE_MODE) {
    setTimeout(() => app.quit(), 25000);
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

  ipcMain.handle('db:get-status', async () => dbLifecycle.getStatus());
  ipcMain.handle('db:create', async () => dbLifecycle.createNewDb());
  ipcMain.handle('db:select', async () => dbLifecycle.chooseExistingDb());
  ipcMain.handle('db:delete-active', async () => dbLifecycle.deleteActiveDb());
  ipcMain.handle('db:create-at-path', async (_event, dbPath) => dbLifecycle.createDbAtPath(dbPath));
  ipcMain.handle('db:select-path', async (_event, dbPath) => dbLifecycle.selectDbAtPath(dbPath));

  const win = createWindow();
  await loadRenderer(win);

  if (CAPTURE_DIR) {
    await captureView(win, '#/configure', 'phase2-desktop-settings.png');
    await captureView(win, '#/dashboard', 'phase2-desktop-dashboard.png');
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
  dbLifecycle.closeActive();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
