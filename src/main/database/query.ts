import { getDatabase, saveDatabase } from './index';

export function query(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params as never[]);

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
  const results = query(sql, params);
  return results[0];
}

export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const db = getDatabase();
  db.run(sql, params as never[]);
  const changes = db.getRowsModified();
  const lastRow = queryOne('SELECT last_insert_rowid() as id');
  saveDatabase();
  return { changes, lastInsertRowid: (lastRow?.id as number) || 0 };
}

export function exec(sql: string): void {
  const db = getDatabase();
  db.run(sql);
  saveDatabase();
}
