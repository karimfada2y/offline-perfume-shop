import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export async function createBackupOnStart(dbPath: string): Promise<void> {
  try {
    if (!fs.existsSync(dbPath)) return;

    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.db'));
    const today = new Date().toISOString().split('T')[0];
    const hasTodayBackup = files.some(f => f.includes(today));

    if (!hasTodayBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
      fs.copyFileSync(dbPath, backupPath);

      if (fs.existsSync(dbPath + '-wal')) {
        fs.copyFileSync(dbPath + '-wal', backupPath + '-wal');
      }
      if (fs.existsSync(dbPath + '-shm')) {
        fs.copyFileSync(dbPath + '-shm', backupPath + '-shm');
      }
    }

    cleanupOldBackups(backupDir);
  } catch (error) {
    console.error('Backup on start failed:', error);
  }
}

function cleanupOldBackups(backupDir: string, maxBackups: number = 30): void {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxBackups) {
      for (const file of files.slice(maxBackups)) {
        fs.unlinkSync(file.path);
        try { fs.unlinkSync(file.path + '-wal'); } catch {}
        try { fs.unlinkSync(file.path + '-shm'); } catch {}
      }
    }
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
}
