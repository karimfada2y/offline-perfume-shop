import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { initializeDatabase } from './database';
import { registerIpcHandlers } from './ipc';
import { registerLicensingHandlers } from './ipc/licensing';
import { createBackupOnStart } from './backup';
import { hasValidLocalActivation } from './licensing/licensing-client';

let mainWindow: BrowserWindow | null = null;
let licenseWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function getAppDataPath(): string {
  return path.join(app.getPath('userData'), 'data');
}

function getDbPath(): string {
  return path.join(getAppDataPath(), 'shop.db');
}

function createLicenseWindow(): void {
  licenseWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    title: 'تفعيل محل العطور - Activate',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    licenseWindow.loadURL('http://localhost:5173/#/license');
    licenseWindow.webContents.openDevTools();
  } else {
    licenseWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/license' });
  }

  licenseWindow.once('ready-to-show', () => {
    licenseWindow?.show();
  });

  licenseWindow.on('closed', () => {
    licenseWindow = null;
  });
}

function createMainWindow(hash?: string): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'محل العطور - Offline Perfume Shop',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173${hash ? '#' + hash : ''}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    registerLicensingHandlers();

    const activated = hasValidLocalActivation();

    if (!activated) {
      createLicenseWindow();

      ipcMain.on('licensing:activated', async () => {
        switchingWindows = true;
        try {
          const dataPath = getAppDataPath();
          const dbPath = getDbPath();
          await initializeDatabase(dbPath);
          await createBackupOnStart(dbPath);
          registerIpcHandlers(dbPath);
          createMainWindow('/setup');
          if (licenseWindow) {
            licenseWindow.close();
            licenseWindow = null;
          }
        } finally {
          switchingWindows = false;
        }
      });

    } else {
      const dataPath = getAppDataPath();
      const dbPath = getDbPath();

      await initializeDatabase(dbPath);
      await createBackupOnStart(dbPath);

      registerIpcHandlers(dbPath);
      createMainWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        if (hasValidLocalActivation()) {
          createMainWindow();
        } else {
          createLicenseWindow();
        }
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

let switchingWindows = false;

app.on('window-all-closed', () => {
  if (switchingWindows) return;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export { mainWindow, getDbPath, getAppDataPath };
