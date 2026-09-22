import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel } from './toCamel';

export function registerBrandHandlers(): void {
  ipcMain.handle('brands:list', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM brands ORDER BY name_ar').all().map(toCamel);
  });

  ipcMain.handle('brands:create', async (_event, brand: Record<string, unknown>) => {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare('INSERT INTO brands (name_ar, name_en, description, created_at) VALUES (?, ?, ?, ?)').run(
      brand.nameAr, brand.nameEn, brand.description, now
    );
    logAudit(null, 'brand_created', 'brand', result.lastInsertRowid as number, `Brand ${brand.nameAr} created`);
    return result.lastInsertRowid;
  });

  ipcMain.handle('brands:update', async (_event, id: number, brand: Record<string, unknown>) => {
    const db = getDb();
    db.prepare('UPDATE brands SET name_ar = ?, name_en = ?, description = ? WHERE id = ?').run(
      brand.nameAr, brand.nameEn, brand.description, id
    );
    logAudit(null, 'brand_updated', 'brand', id, 'Brand updated');
    return true;
  });

  ipcMain.handle('brands:delete', async (_event, id: number) => {
    const db = getDb();
    db.prepare('UPDATE brands SET active = 0 WHERE id = ?').run(id);
    logAudit(null, 'brand_deleted', 'brand', id, 'Brand deactivated');
    return true;
  });
}
