import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { reloadDatabase } from '../database/index';

function getAllowedBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

function isPathAllowed(filePath: string, allowedDir: string): boolean {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);
  return resolved.startsWith(allowed + path.sep) || resolved === allowed;
}

function isPathWithinUserData(filePath: string): boolean {
  const userData = app.getPath('userData');
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(userData);
  return resolved.startsWith(allowed + path.sep) || resolved === allowed;
}

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async (_event, customPath?: string) => {
    const dbPath = path.join(app.getPath('userData'), 'data', 'shop.db');
    const logoDir = path.join(app.getPath('userData'), 'assets', 'logo');

    let backupDir: string;
    if (customPath) {
      if (!isPathWithinUserData(customPath)) {
        throw new Error('Backup path must be within application data directory');
      }
      backupDir = customPath;
    } else {
      backupDir = getAllowedBackupDir();
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(backupDir, `backup_${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    try {
      if (fs.existsSync(dbPath + '-wal')) {
        fs.copyFileSync(dbPath + '-wal', backupPath + '-wal');
      }
      if (fs.existsSync(dbPath + '-shm')) {
        fs.copyFileSync(dbPath + '-shm', backupPath + '-shm');
      }
    } catch {
      // WAL/SHM files may not exist, that's ok
    }

    if (fs.existsSync(logoDir)) {
      const logoBackupDir = path.join(backupDir, `backup_${timestamp}_logos`);
      fs.mkdirSync(logoBackupDir, { recursive: true });
      const logoFiles = fs.readdirSync(logoDir);
      for (const f of logoFiles) {
        fs.copyFileSync(path.join(logoDir, f), path.join(logoBackupDir, f));
      }
    }

    return backupPath;
  });

  ipcMain.handle('backup:restore', async (_event, backupPath: string) => {
    const dbPath = path.join(app.getPath('userData'), 'data', 'shop.db');
    const allowedBackupDir = getAllowedBackupDir();

    if (!isPathAllowed(backupPath, allowedBackupDir)) {
      throw new Error('Backup file must be in the application backups directory');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    const stats = fs.statSync(backupPath);
    if (stats.size < 100) {
      throw new Error('Backup file appears to be corrupted (too small)');
    }

    const safetyBackupDir = path.join(app.getPath('userData'), 'backups', 'safety');
    if (!fs.existsSync(safetyBackupDir)) {
      fs.mkdirSync(safetyBackupDir, { recursive: true });
    }
    const safetyBackup = path.join(safetyBackupDir, `safety_${Date.now()}.db`);
    fs.copyFileSync(dbPath, safetyBackup);

    try {
      fs.copyFileSync(backupPath, dbPath);

      if (fs.existsSync(backupPath + '-wal')) {
        fs.copyFileSync(backupPath + '-wal', dbPath + '-wal');
      } else {
        try { fs.unlinkSync(dbPath + '-wal'); } catch { /* ok */ }
      }
      if (fs.existsSync(backupPath + '-shm')) {
        fs.copyFileSync(backupPath + '-shm', dbPath + '-shm');
      } else {
        try { fs.unlinkSync(dbPath + '-shm'); } catch { /* ok */ }
      }

      const logoDir = path.join(app.getPath('userData'), 'assets', 'logo');
      const backupName = path.basename(backupPath, '.db');
      const logoBackupDir = path.join(path.dirname(backupPath), `${backupName}_logos`);
      if (fs.existsSync(logoBackupDir)) {
        if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
        const existingLogos = fs.readdirSync(logoDir);
        for (const f of existingLogos) fs.unlinkSync(path.join(logoDir, f));
        const logoFiles = fs.readdirSync(logoBackupDir);
        for (const f of logoFiles) fs.copyFileSync(path.join(logoBackupDir, f), path.join(logoDir, f));
      }
    } catch (error) {
      fs.copyFileSync(safetyBackup, dbPath);
      throw new Error(`Restore failed, database restored from safety backup: ${(error as Error).message}`);
    }

    try {
      reloadDatabase();
    } catch {
      // If reload fails, the user needs to restart the app
    }

    return { success: true, safetyBackup };
  });

  ipcMain.handle('backup:list', async () => {
    const backupDir = getAllowedBackupDir();
    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db') && !f.startsWith('safety_')).map(f => {
      const filePath = path.join(backupDir, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      };
    });

    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}
