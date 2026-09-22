import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { toCamel, toCamelAll } from './toCamel';

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', async (_event, filters?: { entity?: string; userId?: number; from?: string; to?: string }) => {
    const db = getDb();
    let query = `
      SELECT a.*, u.display_name as user_name, u.username
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.entity) {
      query += ' AND a.entity = ?';
      params.push(filters.entity);
    }
    if (filters?.userId) {
      query += ' AND a.user_id = ?';
      params.push(filters.userId);
    }
    if (filters?.from) {
      query += ' AND a.created_at >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND a.created_at <= ?';
      params.push(filters.to + 'T23:59:59');
    }

    query += ' ORDER BY a.created_at DESC LIMIT 1000';
    return db.prepare(query).all(...params).map(toCamel);
  });
}
