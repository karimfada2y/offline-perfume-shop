import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDb } from '../database/wrapper';
import path from 'path';
import fs from 'fs';
import { toCamel } from './toCamel';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => {
    const db = getDb();
    const business = db.prepare('SELECT * FROM business WHERE id = 1').get();
    const settings = db.prepare('SELECT * FROM app_settings').all() as Array<{ key: string; value: string }>;
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return { business: business ? toCamel(business as Record<string, unknown>) : null, settings: settingsMap };
  });

  ipcMain.handle('settings:update', async (_event, data: Record<string, unknown>) => {
    const db = getDb();
    const now = new Date().toISOString();

    if (data.business) {
      const b = data.business as Record<string, unknown>;
      db.prepare(`
        UPDATE business SET name_ar = ?, name_en = ?, address = ?, address_ar = ?, address_en = ?, phone = ?, whatsapp = ?, tax_number = ?, email = ?, commercial_registration = ?, footer_ar = ?, footer_en = ?, updated_at = ?
        WHERE id = 1
      `).run(
        b.nameAr, b.nameEn, b.address || '', b.addressAr || '', b.addressEn || '',
        b.phone, b.whatsapp, b.taxNumber, b.email || '', b.commercialRegistration || '',
        b.footerAr || '', b.footerEn || '', now
      );
    }

    if (data.settings) {
      const settings = data.settings as Record<string, string>;
      const upsert = db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?');
      for (const [key, value] of Object.entries(settings)) {
        upsert.run(key, value, now, value, now);
      }
    }
  });

  ipcMain.handle('settings:uploadLogo', async (_event, type: 'main' | 'invoice') => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) throw new Error('No active window');

    const result = await dialog.showOpenDialog(window, {
      title: 'Select Logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];

    const fileStats = fs.statSync(filePath);
    if (fileStats.size > MAX_LOGO_SIZE) {
      throw new Error(`File too large (max ${MAX_LOGO_SIZE / 1024 / 1024}MB)`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
    if (!allowedExts.includes(ext)) {
      throw new Error('Invalid file type');
    }

    const safeExt = sanitizeFilename(ext);
    const fileName = `${type === 'main' ? 'main' : 'invoice'}_logo_${Date.now()}${safeExt}`;
    const dataPath = path.join(require('electron').app.getPath('userData'), 'data');
    const destPath = path.join(dataPath, 'logos');

    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });

    const destFile = path.join(destPath, fileName);
    fs.copyFileSync(filePath, destFile);

    const db = getDb();
    const now = new Date().toISOString();

    if (type === 'main') {
      const old = db.prepare('SELECT logo_path FROM business WHERE id = 1').get() as { logo_path: string } | undefined;
      if (old?.logo_path && fs.existsSync(old.logo_path)) {
        try { fs.unlinkSync(old.logo_path); } catch { /* ok */ }
      }
      db.prepare('UPDATE business SET logo_path = ?, updated_at = ? WHERE id = 1').run(destFile, now);
    } else {
      const old = db.prepare('SELECT invoice_logo_path FROM business WHERE id = 1').get() as { invoice_logo_path: string } | undefined;
      if (old?.invoice_logo_path && fs.existsSync(old.invoice_logo_path)) {
        try { fs.unlinkSync(old.invoice_logo_path); } catch { /* ok */ }
      }
      db.prepare('UPDATE business SET invoice_logo_path = ?, updated_at = ? WHERE id = 1').run(destFile, now);
    }

    return destFile;
  });

  ipcMain.handle('settings:getBusinessInfo', async () => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM business WHERE id = 1').get();
    return row ? toCamel(row as Record<string, unknown>) : null;
  });
}
