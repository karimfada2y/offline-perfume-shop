import { app, BrowserWindow, ipcMain } from 'electron';
import type { AppUpdater } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

const STARTUP_CHECK_DELAY_MS = 20_000;

export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

let updater: AppUpdater | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let lastStatus: UpdateStatus = { state: 'idle' };

function send(status: UpdateStatus): void {
  lastStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('updater:status', status);
    }
  }
}

function wire(auto: AppUpdater): AppUpdater {
  auto.autoDownload = false;

  auto.on('checking-for-update', () => send({ state: 'checking' }));

  auto.on('update-available', (info) =>
    send({ state: 'available', version: info.version })
  );

  auto.on('update-not-available', () => send({ state: 'not-available' }));

  auto.on('download-progress', (progress) =>
    send({
      state: 'downloading',
      percent: Math.round(progress.percent),
      message: `${Math.round(progress.bytesPerSecond / 1024 / 1024)} MB/s`,
    })
  );

  auto.on('update-downloaded', (info) =>
    send({ state: 'downloaded', version: info.version })
  );

  auto.on('error', (error) =>
    send({ state: 'error', message: error?.message ?? String(error) })
  );

  return auto;
}

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', async () => {
    if (app.isPackaged) {
      updater = wire(autoUpdater);
      try {
        const result = await updater.checkForUpdates();
        if (!result?.updateInfo) {
          send({ state: 'not-available' });
        }
      } catch (error) {
        send({ state: 'error', message: (error as Error).message });
      }
    } else {
      send({ state: 'not-available' });
    }
    return lastStatus;
  });

  ipcMain.handle('updater:download', async () => {
    if (!updater && app.isPackaged) {
      updater = wire(autoUpdater);
    }
    try {
      await updater?.downloadUpdate();
    } catch (error) {
      send({ state: 'error', message: (error as Error).message });
    }
    return lastStatus;
  });

  ipcMain.handle('updater:install', () => {
    if (updater) {
      setImmediate(() => {
        updater?.quitAndInstall(false, true);
      });
    }
  });

  ipcMain.handle('updater:status', () => lastStatus);
}

export function scheduleStartupUpdateCheck(): void {
  if (!app.isPackaged || startupTimer) return;

  startupTimer = setTimeout(() => {
    startupTimer = null;
    updater = wire(autoUpdater);
    updater.checkForUpdates().catch(() => {
      /* surfaced to the renderer via the error event */
    });
  }, STARTUP_CHECK_DELAY_MS);
}
