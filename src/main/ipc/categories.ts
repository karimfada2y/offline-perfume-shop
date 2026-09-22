import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel } from './toCamel';

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM categories ORDER BY sort_order, name_ar').all().map(toCamel);
  });

  ipcMain.handle('categories:create', async (_event, cat: Record<string, unknown>) => {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare('INSERT INTO categories (name_ar, name_en, description, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      cat.nameAr, cat.nameEn, cat.description, cat.parentId, cat.sortOrder || 0, now
    );
    logAudit(null, 'category_created', 'category', result.lastInsertRowid as number, `Category ${cat.nameAr} created`);
    return result.lastInsertRowid;
  });

  ipcMain.handle('categories:update', async (_event, id: number, cat: Record<string, unknown>) => {
    const db = getDb();
    db.prepare('UPDATE categories SET name_ar = ?, name_en = ?, description = ?, parent_id = ?, sort_order = ? WHERE id = ?').run(
      cat.nameAr, cat.nameEn, cat.description, cat.parentId, cat.sortOrder || 0, id
    );
    logAudit(null, 'category_updated', 'category', id, 'Category updated');
    return true;
  });

  ipcMain.handle('categories:delete', async (_event, id: number) => {
    const db = getDb();
    db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id);
    logAudit(null, 'category_deleted', 'category', id, 'Category deactivated');
    return true;
  });
}
