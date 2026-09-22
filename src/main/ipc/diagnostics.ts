import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function registerDiagnosticHandlers(): void {
  ipcMain.handle('diagnostics:run', async () => {
    const db = getDb();
    const dbPath = path.join(app.getPath('userData'), 'data', 'shop.db');
    const results: Record<string, unknown> = {};

    try {
      const integrity = db.pragma('integrity_check');
      results.integrity = integrity;
    } catch (e) {
      results.integrity = { error: (e as Error).message };
    }

    try {
      const fkCheck = db.pragma('foreign_key_check');
      results.foreignKeys = fkCheck;
    } catch (e) {
      results.foreignKeys = { error: (e as Error).message };
    }

    try {
      const stats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM products) as products,
          (SELECT COUNT(*) FROM customers) as customers,
          (SELECT COUNT(*) FROM suppliers) as suppliers,
          (SELECT COUNT(*) FROM sales) as sales,
          (SELECT COUNT(*) FROM purchase_invoices) as purchases,
          (SELECT COUNT(*) FROM production_batches) as production_batches,
          (SELECT COUNT(*) FROM journal_entries) as journal_entries,
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM audit_logs) as audit_logs
      `).get();
      results.counts = stats;
    } catch (e) {
      results.counts = { error: (e as Error).message };
    }

    try {
      const unbalanced = db.prepare(`
        SELECT je.id, je.entry_number,
               (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) as total_debit,
               (SELECT SUM(credit) FROM journal_entry_lines WHERE journal_entry_id = je.id) as total_credit
        FROM journal_entries je
        WHERE (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) !=
              (SELECT SUM(credit) FROM journal_entry_lines WHERE journal_entry_id = je.id)
      `).all();
      results.unbalancedEntries = unbalanced;
    } catch (e) {
      results.unbalancedEntries = { error: (e as Error).message };
    }

    try {
      const negativeStock = db.prepare(`
        SELECT id, name_ar, current_stock FROM products
        WHERE active = 1 AND inventory_tracked = 1 AND current_stock < 0
      `).all();
      results.negativeStock = negativeStock;
    } catch (e) {
      results.negativeStock = { error: (e as Error).message };
    }

    try {
      const fileStats = fs.statSync(dbPath);
      results.databaseSize = fileStats.size;
      results.databasePath = dbPath;
    } catch (e) {
      results.databaseSize = 0;
    }

    results.version = '1.0.0';

    return results;
  });
}
