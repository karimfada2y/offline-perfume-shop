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

export function registerCustomerHandlers(): void {
  ipcMain.handle('customers:list', async (_event, filters?: { search?: string }) => {
    const db = getDb();
    let query = 'SELECT * FROM customers WHERE active = 1';
    const params: unknown[] = [];

    if (filters?.search) {
      query += ' AND (name_ar LIKE ? OR name_en LIKE ? OR phone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY name_ar';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('customers:create', async (_event, customer: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const openingBalance = (customer.openingBalance as number) || 0;

    const createCustomer = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO customers (name_ar, name_en, phone, whatsapp, address, email, notes, opening_balance, current_balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.nameAr, customer.nameEn, customer.phone, customer.whatsapp,
        customer.address, customer.email, customer.notes, openingBalance, openingBalance, now, now
      );

      const customerId = result.lastInsertRowid as number;

      if (openingBalance !== 0) {
        db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, description, created_at)
          VALUES (?, 'OPENING_BALANCE', ?, ?, 'رصيد افتتاحي', ?)
        `).run(customerId, openingBalance, openingBalance, now);
      }

      logAudit(null, 'customer_created', 'customer', customerId, `Customer ${customer.nameAr} created`);
      return customerId;
    });

    return createCustomer();
  });

  ipcMain.handle('customers:update', async (_event, id: number, customer: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!existing) {
      throw new Error('Customer not found');
    }

    db.prepare(`
      UPDATE customers SET name_ar = ?, name_en = ?, phone = ?, whatsapp = ?, address = ?, email = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(customer.nameAr, customer.nameEn, customer.phone, customer.whatsapp, customer.address, customer.email, customer.notes, now, id);
    logAudit(null, 'customer_updated', 'customer', id, 'Customer updated');
    return true;
  });

  ipcMain.handle('customers:getAccount', async (_event, id: number) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return row ? toCamel(row as Record<string, unknown>) : null;
  });

  ipcMain.handle('customers:getTransactions', async (_event, id: number) => {
    const db = getDb();
    return db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC').all(id).map(toCamel);
  });
}
