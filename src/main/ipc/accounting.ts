import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { toCamel, toCamelAll } from './toCamel';

export function registerAccountingHandlers(): void {
  ipcMain.handle('accounting:listAccounts', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM accounts WHERE active = 1 ORDER BY code').all().map(toCamel);
  });

  ipcMain.handle('accounting:listEntries', async (_event, filters?: { from?: string; to?: string; referenceType?: string }) => {
    const db = getDb();
    let query = 'SELECT * FROM journal_entries WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.from) {
      query += ' AND date >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND date <= ?';
      params.push(filters.to);
    }
    if (filters?.referenceType) {
      query += ' AND reference_type = ?';
      params.push(filters.referenceType);
    }

    query += ' ORDER BY created_at DESC';

    const entries = db.prepare(query).all(...params).map(toCamel) as Array<Record<string, unknown>>;

    for (const entry of entries) {
      entry.lines = db.prepare(`
        SELECT jel.*, a.code as account_code, a.name_ar as account_name_ar, a.name_en as account_name_en
        FROM journal_entry_lines jel
        JOIN accounts a ON a.id = jel.account_id
        WHERE jel.journal_entry_id = ?
      `).all(entry.id).map(toCamel);
    }

    return entries;
  });

  ipcMain.handle('accounting:trialBalance', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT a.code, a.name_ar, a.name_en, a.type,
             COALESCE(SUM(jel.debit), 0) as total_debit,
             COALESCE(SUM(jel.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      WHERE a.active = 1
      GROUP BY a.id
      ORDER BY a.code
    `).all().map(toCamel);
  });
}
