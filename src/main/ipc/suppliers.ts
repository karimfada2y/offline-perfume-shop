import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel, toCamelAll } from './toCamel';

function getLocalTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

export function registerSupplierHandlers(): void {
  ipcMain.handle('suppliers:list', async (_event, filters?: { search?: string }) => {
    const db = getDb();
    let query = 'SELECT * FROM suppliers WHERE active = 1';
    const params: unknown[] = [];

    if (filters?.search) {
      query += ' AND (name_ar LIKE ? OR name_en LIKE ? OR phone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY name_ar';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('suppliers:create', async (_event, supplier: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const openingBalance = (supplier.openingBalance as number) || 0;

    const createSupplier = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO suppliers (name_ar, name_en, phone, whatsapp, address, notes, opening_balance, current_balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplier.nameAr, supplier.nameEn, supplier.phone, supplier.whatsapp,
        supplier.address, supplier.notes, openingBalance, openingBalance, now, now
      );

      const supplierId = result.lastInsertRowid as number;

      if (openingBalance !== 0) {
        db.prepare(`
          INSERT INTO supplier_transactions (supplier_id, type, amount, balance_after, description, created_at)
          VALUES (?, 'OPENING_BALANCE', ?, ?, 'رصيد افتتاحي', ?)
        `).run(supplierId, openingBalance, openingBalance, now);
      }

      logAudit(null, 'supplier_created', 'supplier', supplierId, `Supplier ${supplier.nameAr} created`);
      return supplierId;
    });

    return createSupplier();
  });

  ipcMain.handle('suppliers:update', async (_event, id: number, supplier: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!existing) {
      throw new Error('Supplier not found');
    }

    db.prepare(`
      UPDATE suppliers SET name_ar = ?, name_en = ?, phone = ?, whatsapp = ?, address = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(supplier.nameAr, supplier.nameEn, supplier.phone, supplier.whatsapp, supplier.address, supplier.notes, now, id);
    logAudit(null, 'supplier_updated', 'supplier', id, 'Supplier updated');
    return true;
  });

  ipcMain.handle('suppliers:getAccount', async (_event, id: number) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    return row ? toCamel(row as Record<string, unknown>) : null;
  });

  ipcMain.handle('suppliers:getTransactions', async (_event, id: number) => {
    const db = getDb();
    return db.prepare('SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY created_at DESC').all(id).map(toCamel);
  });
}
