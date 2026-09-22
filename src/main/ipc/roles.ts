import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit, requireOwner } from './index';
import { toCamel, toCamelAll } from './toCamel';

export function registerRoleHandlers(): void {
  ipcMain.handle('roles:list', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM roles ORDER BY name').all().map(toCamel);
  });

  ipcMain.handle('roles:getPermissions', async () => {
    const db = getDb();
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY category, name').all().map(toCamel);
    const rolePermissions = db.prepare('SELECT * FROM role_permissions').all().map(toCamel) as Array<{ role_id: number; permission_id: number }>;

    const map: Record<number, number[]> = {};
    for (const rp of rolePermissions) {
      if (!map[rp.role_id]) map[rp.role_id] = [];
      map[rp.role_id].push(rp.permission_id);
    }

    return { permissions, rolePermissions: map };
  });

  ipcMain.handle('roles:updatePermissions', async (_event, roleId: number, permissionIds: number[], token?: string) => {
    const session = requireOwner(token);
    const db = getDb();

    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(roleId) as { name: string } | undefined;
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.name === 'owner') {
      throw new Error('Cannot modify owner role permissions');
    }

    const updateTx = db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
      const insert = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const pid of permissionIds) {
        insert.run(roleId, pid);
      }
    });

    updateTx();
    logAudit(session.userId, 'role_permissions_updated', 'role', roleId, `Permissions updated for role ${role.name}`);
    return true;
  });
}
