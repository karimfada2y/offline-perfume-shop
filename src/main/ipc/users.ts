import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { hashPassword } from '../security/auth';
import { logAudit, requireAuth } from './index';
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

export function registerUserHandlers(): void {
  ipcMain.handle('users:list', async (_event, token?: string) => {
    requireAuth(token);
    const db = getDb();
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.role_id, u.active, u.created_at, r.name as role_name, r.display_name_ar as role_name_ar
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.display_name
    `).all().map(toCamel);
  });

  ipcMain.handle('users:create', async (_event, user: Record<string, unknown>, token?: string) => {
    const session = requireAuth(token);
    const db = getDb();
    const now = getLocalTimestamp();

    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.roleId) as { name: string } | undefined;
    if (role && (role.name === 'owner')) {
      const callerRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(session.roleId) as { name: string } | undefined;
      if (!callerRole || callerRole.name !== 'owner') {
        throw new Error('Only owners can create owner accounts');
      }
    }

    if (!user.username || !String(user.username).trim()) {
      throw new Error('Username is required');
    }
    if (!user.password || !String(user.password).trim()) {
      throw new Error('Password is required');
    }
    if (String(user.password).length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (!user.displayName || !String(user.displayName).trim()) {
      throw new Error('Display name is required');
    }
    if (!user.roleId) {
      throw new Error('Role is required');
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    if (existing) {
      throw new Error('Username already exists');
    }

    const passwordHash = hashPassword(user.password as string);

    const result = db.prepare(`
      INSERT INTO users (username, display_name, password_hash, role_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.username, user.displayName, passwordHash, user.roleId, user.active !== false ? 1 : 0, now, now);

    logAudit(session.userId, 'user_created', 'user', result.lastInsertRowid as number, `User ${user.username} created`);
    return result.lastInsertRowid;
  });

  ipcMain.handle('users:update', async (_event, id: number, user: Record<string, unknown>, token?: string) => {
    const session = requireAuth(token);
    const db = getDb();
    const now = getLocalTimestamp();

    const existing = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(id) as { id: number; role_id: number } | undefined;
    if (!existing) {
      throw new Error('User not found');
    }

    if (user.roleId) {
      const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.roleId) as { name: string } | undefined;
      if (targetRole && targetRole.name === 'owner') {
        const callerRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(session.roleId) as { name: string } | undefined;
        if (!callerRole || callerRole.name !== 'owner') {
          throw new Error('Only owners can assign owner role');
        }
      }
    }

    const updateTx = db.transaction(() => {
      if (user.password && String(user.password).trim()) {
        if (String(user.password).length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const passwordHash = hashPassword(user.password as string);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, id);
      }

      db.prepare('UPDATE users SET username = ?, display_name = ?, role_id = ?, active = ?, updated_at = ? WHERE id = ?').run(
        user.username, user.displayName, user.roleId, user.active !== false ? 1 : 0, now, id
      );

      logAudit(session.userId, 'user_updated', 'user', id, `User ${user.username} updated`);
    });

    updateTx();
    return true;
  });

  ipcMain.handle('users:toggleActive', async (_event, id: number, token?: string) => {
    const session = requireAuth(token);
    const db = getDb();
    const now = getLocalTimestamp();
    const user = db.prepare('SELECT active, username, role_id FROM users WHERE id = ?').get(id) as { active: number; username: string; role_id: number } | undefined;
    if (!user) {
      throw new Error('User not found');
    }

    const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id) as { name: string } | undefined;
    if (targetRole && targetRole.name === 'owner') {
      const callerRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(session.roleId) as { name: string } | undefined;
      if (!callerRole || callerRole.name !== 'owner') {
        throw new Error('Only owners can toggle owner accounts');
      }
    }

    const newActive = user.active ? 0 : 1;
    db.prepare('UPDATE users SET active = ?, updated_at = ? WHERE id = ?').run(newActive, now, id);
    logAudit(session.userId, 'user_toggled', 'user', id, `User ${user.username} ${user.active ? 'disabled' : 'enabled'}`);
    return true;
  });
}
