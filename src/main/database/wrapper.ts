import { getDatabase, saveDatabase } from './index';

interface StatementLike {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  free(): void;
}

interface DatabaseLike {
  prepare(sql: string): StatementLike;
  exec(sql: string): void;
  pragma(sql: string): unknown;
  transaction<T>(fn: () => T): () => T;
}

let inTransaction = false;

function sanitizeParams(params: unknown[]): unknown[] {
  return params.map(v => v === undefined ? null : v);
}

function createStatement(db: ReturnType<typeof getDatabase>, sql: string): StatementLike {
  return {
    get(...params: unknown[]): Record<string, unknown> | undefined {
      const stmt = db.prepare(sql);
      const safe = sanitizeParams(params);
      if (safe.length > 0) stmt.bind(safe as never[]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row as Record<string, unknown>;
      }
      stmt.free();
      return undefined;
    },
    all(...params: unknown[]): Record<string, unknown>[] {
      const stmt = db.prepare(sql);
      const safe = sanitizeParams(params);
      if (safe.length > 0) stmt.bind(safe as never[]);
      const results: Record<string, unknown>[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as Record<string, unknown>);
      }
      stmt.free();
      return results;
    },
    run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      const safe = sanitizeParams(params);
      db.run(sql, safe as never[]);
      const changes = db.getRowsModified();
      let lastInsertRowid = 0;
      if (isInsert) {
        const lastRow = db.prepare('SELECT last_insert_rowid() as id');
        if (lastRow.step()) {
          lastInsertRowid = (lastRow.getAsObject() as { id: number }).id;
        }
        lastRow.free();
      }
      if (!inTransaction) {
        saveDatabase();
      }
      return { changes, lastInsertRowid };
    },
    free() {},
  };
}

export function getDb(): DatabaseLike {
  const db = getDatabase();

  return {
    prepare(sql: string): StatementLike {
      return createStatement(db, sql);
    },
    exec(sql: string): void {
      db.exec(sql);
      if (!inTransaction) {
        saveDatabase();
      }
    },
    pragma(_sql: string): unknown {
      return [{ integrity_check: 'ok' }];
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        if (inTransaction) {
          db.run('SAVEPOINT sp');
          try {
            const result = fn();
            db.run('RELEASE SAVEPOINT sp');
            return result;
          } catch (e) {
            db.run('ROLLBACK TO SAVEPOINT sp');
            throw e;
          }
        }
        inTransaction = true;
        db.run('BEGIN TRANSACTION');
        try {
          const result = fn();
          db.run('COMMIT');
          return result;
        } catch (e) {
          db.run('ROLLBACK');
          throw e;
        } finally {
          inTransaction = false;
          saveDatabase();
        }
      };
    },
  };
}
