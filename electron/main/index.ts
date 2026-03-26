import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc/register';
import { settingsService } from './services/settings-service';
import { databaseManager } from './db/client';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1220,
    minHeight: 760,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Open Fireside',
  });

  const devServerUrl = process.env.OPEN_FIRESIDE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  const paths = settingsService.getPaths();
  databaseManager.initialize(paths.dbPath);
  registerIpcHandlers();
  createWindow();
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error('Failed to bootstrap Open Fireside:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
