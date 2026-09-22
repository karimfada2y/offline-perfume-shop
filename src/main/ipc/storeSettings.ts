import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDb } from '../database/wrapper';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { toCamel } from './toCamel';

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function getLogoDir(): string {
  const dir = path.join(app.getPath('userData'), 'assets', 'logo');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerStoreSettingsHandlers(): void {
  ipcMain.handle('storeSettings:get', async () => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
    return row ? toCamel(row as Record<string, unknown>) : {
      id: 1, store_name: '', owner_name: '', phone1: '', phone2: '',
      address: '', city: '', tax_number: '', commercial_number: '',
      logo_path: '', currency: 'EGP',
      show_logo: 1, show_phone: 1, show_address: 1,
      show_tax_number: 1, show_commercial_number: 1,
      receipt_width: '80mm', invoice_footer: '',
      receipt_name: '', invoice_name: '',
      receipt_subtitle: '', invoice_subtitle: '', receipt_footer: '',
    };
  });

  ipcMain.handle('storeSettings:update', async (_event, data: Record<string, unknown>) => {
    const db = getDb();
    const now = new Date().toISOString();
    const fields = [
      'store_name', 'owner_name', 'phone1', 'phone2',
      'address', 'city', 'tax_number', 'commercial_number',
      'currency', 'show_logo', 'show_phone', 'show_address',
      'show_tax_number', 'show_commercial_number', 'receipt_width', 'invoice_footer',
      'receipt_name', 'invoice_name', 'receipt_subtitle', 'invoice_subtitle', 'receipt_footer',
    ];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f} = ?`);
        values.push(data[f]);
      }
    }
    if (sets.length > 0) {
      sets.push('updated_at = ?');
      values.push(now);
      db.prepare(`UPDATE store_settings SET ${sets.join(', ')} WHERE id = 1`).run(...values);
    }
    const updated = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
    return updated ? toCamel(updated as Record<string, unknown>) : null;
  });

  ipcMain.handle('storeSettings:uploadLogo', async (_event, buffer: ArrayBuffer, fileName: string) => {
    const ext = path.extname(fileName).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return { success: false, error: 'هذا الملف غير مدعوم' };
    }

    const dir = getLogoDir();
    const destFile = path.join(dir, `store_logo${ext}`);

    const db = getDb();
    const old = db.prepare('SELECT logo_path FROM store_settings WHERE id = 1').get() as { logo_path: string } | undefined;
    if (old?.logo_path && fs.existsSync(old.logo_path)) {
      try { fs.unlinkSync(old.logo_path); } catch { /* ok */ }
    }

    fs.writeFileSync(destFile, Buffer.from(buffer));

    db.prepare('UPDATE store_settings SET logo_path = ?, updated_at = datetime(\'now\') WHERE id = 1').run(destFile);

    return { success: true, path: destFile };
  });

  ipcMain.handle('storeSettings:removeLogo', async () => {
    const db = getDb();
    const row = db.prepare('SELECT logo_path FROM store_settings WHERE id = 1').get() as { logo_path: string } | undefined;
    if (row?.logo_path && fs.existsSync(row.logo_path)) {
      try { fs.unlinkSync(row.logo_path); } catch { /* ok */ }
    }
    db.prepare('UPDATE store_settings SET logo_path = \'\', updated_at = datetime(\'now\') WHERE id = 1').run();
    return { success: true };
  });
}
