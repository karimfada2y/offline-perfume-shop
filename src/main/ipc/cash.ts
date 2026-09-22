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

export function registerCashHandlers(): void {
  ipcMain.handle('cash:listRegisters', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM cash_registers WHERE active = 1').all().map(toCamel);
  });

  ipcMain.handle('cash:openSession', async (_event, data: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    if (!data.registerId) {
      throw new Error('Register ID is required');
    }
    if ((data.openingCash as number) < 0) {
      throw new Error('Opening cash cannot be negative');
    }

    const activeSession = db.prepare('SELECT id FROM cash_sessions WHERE register_id = ? AND status = ?').get(data.registerId, 'open');
    if (activeSession) {
      throw new Error('There is already an open session for this register');
    }

    const openTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO cash_sessions (register_id, user_id, opening_cash, status, opened_at)
        VALUES (?, ?, ?, 'open', ?)
      `).run(data.registerId, data.userId, data.openingCash || 0, now);

      db.prepare(`
        INSERT INTO cash_movements (session_id, type, amount, description, created_by, created_at)
        VALUES (?, 'OPENING', ?, 'Session opened', ?, ?)
      `).run(result.lastInsertRowid, data.openingCash || 0, data.userId, now);

      logAudit(data.userId as number, 'cash_session_opened', 'cash_session', result.lastInsertRowid as number, `Register session opened with ${(data.openingCash as number) || 0}`);
      return result.lastInsertRowid as number;
    });

    return openTx();
  });

  ipcMain.handle('cash:closeSession', async (_event, sessionId: number, data: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const closeTx = db.transaction(() => {
      const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(sessionId) as {
        id: number;
        status: string;
        opening_cash: number;
      } | undefined;

      if (!session) {
        throw new Error('Cash session not found');
      }
      if (session.status !== 'open') {
        throw new Error(`Cash session is already ${session.status}`);
      }

      const movements = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type IN ('SALE', 'CUSTOMER_PAYMENT', 'CASH_IN') THEN amount ELSE 0 END), 0) as totalIn,
               COALESCE(SUM(CASE WHEN type IN ('EXPENSE', 'REFUND', 'CASH_OUT', 'SUPPLIER_PAYMENT') THEN amount ELSE 0 END), 0) as totalOut
        FROM cash_movements WHERE session_id = ?
      `).get(sessionId) as { totalIn: number; totalOut: number };

      const expectedCash = session.opening_cash + movements.totalIn - movements.totalOut;
      const actualCash = (data.actualCash as number) || 0;
      const difference = actualCash - expectedCash;

      db.prepare(`
        UPDATE cash_sessions SET closing_cash = ?, expected_cash = ?, difference = ?, status = 'closed', closed_at = ?
        WHERE id = ?
      `).run(actualCash, expectedCash, difference, now, sessionId);

      db.prepare(`
        INSERT INTO cash_movements (session_id, type, amount, description, created_by, created_at)
        VALUES (?, 'CLOSING', ?, ?, ?, ?)
      `).run(sessionId, 0, `Closing - Expected: ${expectedCash}, Actual: ${actualCash}, Diff: ${difference}`, data.userId, now);

      logAudit(data.userId as number, 'cash_session_closed', 'cash_session', sessionId, `Session closed - Expected: ${expectedCash}, Actual: ${actualCash}, Difference: ${difference}`);
    });

    closeTx();
    return true;
  });

  ipcMain.handle('cash:getActiveSession', async () => {
    const db = getDb();
    const row = db.prepare(`
      SELECT cs.*, cr.name as register_name, u.display_name as user_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cr.id = cs.register_id
      JOIN users u ON u.id = cs.user_id
      WHERE cs.status = 'open'
      ORDER BY cs.opened_at DESC
      LIMIT 1
    `).get();
    return row ? toCamel(row as Record<string, unknown>) : null;
  });

  ipcMain.handle('cash:getMovements', async (_event, sessionId: number) => {
    const db = getDb();
    return db.prepare(`
      SELECT cm.*, u.display_name as user_name
      FROM cash_movements cm
      LEFT JOIN users u ON u.id = cm.created_by
      WHERE cm.session_id = ?
      ORDER BY cm.created_at
    `).all(sessionId).map(toCamel);
  });

  ipcMain.handle('cash:getClosingReport', async (_event, sessionId: number) => {
    const db = getDb();
    const session = db.prepare(`
      SELECT cs.*, cr.name as register_name, u.display_name as user_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cr.id = cs.register_id
      JOIN users u ON u.id = cs.user_id
      WHERE cs.id = ?
    `).get(sessionId) as Record<string, unknown> | undefined;
    if (!session) throw new Error('Session not found');

    const cashSales = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'SALE'
    `).get(sessionId) as { total: number };

    const cashPayments = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'CUSTOMER_PAYMENT'
    `).get(sessionId) as { total: number };

    const cashIn = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'CASH_IN'
    `).get(sessionId) as { total: number };

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'EXPENSE'
    `).get(sessionId) as { total: number };

    const refunds = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'REFUND'
    `).get(sessionId) as { total: number };

    const cashOut = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'CASH_OUT'
    `).get(sessionId) as { total: number };

    const supplierPayments = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements WHERE session_id = ? AND type = 'SUPPLIER_PAYMENT'
    `).get(sessionId) as { total: number };

    const byPaymentMethod = db.prepare(`
      SELECT s.payment_method, COUNT(*) as count, SUM(s.paid) as total
      FROM sales s WHERE s.cash_session_id = ?
      GROUP BY s.payment_method
    `).all(sessionId);

    const totalIn = cashSales.total + cashPayments.total + cashIn.total;
    const totalOut = expenses.total + refunds.total + cashOut.total + supplierPayments.total;
    const expectedCash = (session.opening_cash as number) + totalIn - totalOut;

    return {
      session: toCamel(session),
      openingCash: session.opening_cash,
      cashSales: cashSales.total,
      cashPayments: cashPayments.total,
      cashIn: cashIn.total,
      expenses: expenses.total,
      refunds: refunds.total,
      cashOut: cashOut.total,
      supplierPayments: supplierPayments.total,
      totalIn,
      totalOut,
      expectedCash,
      byPaymentMethod,
    };
  });
}
