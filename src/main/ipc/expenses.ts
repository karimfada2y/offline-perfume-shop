import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel, toCamelAll } from './toCamel';

function getLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

export function registerExpenseHandlers(): void {
  ipcMain.handle('expenses:list', async (_event, filters?: { from?: string; to?: string; categoryId?: number }) => {
    const db = getDb();
    let query = `
      SELECT e.*, ec.name_ar as category_name, ec.name_en as category_name_en, u.display_name as user_name
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.from) {
      query += ' AND e.date >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND e.date <= ?';
      params.push(filters.to);
    }
    if (filters?.categoryId) {
      query += ' AND e.category_id = ?';
      params.push(filters.categoryId);
    }

    query += ' ORDER BY e.created_at DESC';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('expenses:create', async (_event, expense: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const today = getLocalDate();

    if (!expense.categoryId) {
      throw new Error('Expense category is required');
    }
    if (!expense.amount || (expense.amount as number) <= 0) {
      throw new Error('Expense amount must be positive');
    }
    if (expense.cashSessionId) {
      const session = db.prepare('SELECT status FROM cash_sessions WHERE id = ?').get(expense.cashSessionId) as { status: string } | undefined;
      if (!session) {
        throw new Error('Cash session not found');
      }
      if (session.status !== 'open') {
        throw new Error('Cash session is not open');
      }
    }

    const expenseAccount = db.prepare("SELECT id FROM accounts WHERE code = '6000'").get() as { id: number } | undefined;
    const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get() as { id: number } | undefined;

    if (!expenseAccount || !cashAccount) {
      throw new Error('Required accounts not found');
    }

    const createExpense = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO expenses (category_id, amount, date, payment_method, description, cash_session_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expense.categoryId, expense.amount, expense.date || today,
        expense.paymentMethod || 'cash', expense.description, expense.cashSessionId || null,
        expense.userId, now
      );

      const expenseId = result.lastInsertRowid as number;

      if (expense.cashSessionId) {
        db.prepare(`
          INSERT INTO cash_movements (session_id, type, amount, description, reference_type, reference_id, created_by, created_at)
          VALUES (?, 'EXPENSE', ?, ?, 'expense', ?, ?, ?)
        `).run(expense.cashSessionId, expense.amount, expense.description || 'Expense', expenseId, expense.userId, now);
      }

      const entryNumber = `JE-EXP-${Date.now()}-${expenseId}`;
      const entryResult = db.prepare(`
        INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, created_by, created_at)
        VALUES (?, ?, ?, 'expense', ?, ?, ?)
      `).run(entryNumber, expense.date || today, expense.description || 'Expense', expenseId, expense.userId, now);

      const entryId = entryResult.lastInsertRowid as number;
      db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)').run(
        entryId, expenseAccount.id, expense.amount, 0, 'Expense'
      );
      db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)').run(
        entryId, cashAccount.id, 0, expense.amount, 'Cash outflow'
      );

      logAudit(expense.userId as number, 'expense_created', 'expense', expenseId, `Expense ${expense.amount} created`);
      return expenseId;
    });

    return createExpense();
  });

  ipcMain.handle('expenses:delete', async (_event, id: number) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!expense) {
      throw new Error('Expense not found');
    }

    const deleteTx = db.transaction(() => {
      if (expense.cash_session_id) {
        const movement = db.prepare('SELECT id FROM cash_movements WHERE reference_type = ? AND reference_id = ?').get('expense', id);
        if (movement) {
          db.prepare('DELETE FROM cash_movements WHERE reference_type = ? AND reference_id = ?').run('expense', id);
        }
      }

      const journalEntry = db.prepare('SELECT id FROM journal_entries WHERE reference_type = ? AND reference_id = ?').get('expense', id) as { id: number } | undefined;
      if (journalEntry) {
        db.prepare('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?').run(journalEntry.id);
        db.prepare('DELETE FROM journal_entries WHERE id = ?').run(journalEntry.id);
      }

      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

      logAudit(expense.created_by as number, 'expense_deleted', 'expense', id, `Expense ${id} deleted`);
    });

    deleteTx();
    return true;
  });

  ipcMain.handle('expenses:categories', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM expense_categories WHERE active = 1 ORDER BY name_ar').all().map(toCamel);
  });
}
