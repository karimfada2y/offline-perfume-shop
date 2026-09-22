import { BrowserWindow, ipcMain, dialog } from 'electron';
import { getDb } from '../database/wrapper';
import { hashPassword, verifyPassword, createSession, destroySession, getUserPermissions, validateSession } from '../security/auth';
import { registerProductHandlers } from './products';
import { registerCategoryHandlers } from './categories';
import { registerBrandHandlers } from './brands';
import { registerCustomerHandlers } from './customers';
import { registerSupplierHandlers } from './suppliers';
import { registerPurchaseHandlers } from './purchases';
import { registerSaleHandlers } from './sales';
import { registerCashHandlers } from './cash';
import { registerExpenseHandlers } from './expenses';
import { registerProductionHandlers } from './production';
import { registerAccountingHandlers } from './accounting';
import { registerReportHandlers } from './reports';
import { registerSettingsHandlers } from './settings';
import { registerBackupHandlers } from './backup';
import { registerAuditHandlers } from './audit';
import { registerInventoryHandlers } from './inventory';
import { registerUserHandlers } from './users';
import { registerRoleHandlers } from './roles';
import { registerPrintHandlers } from './print';
import { registerDiagnosticHandlers } from './diagnostics';
import { registerExportHandlers } from './export';
import { registerStoreSettingsHandlers } from './storeSettings';

let ownerCreated = false;

export function requireAuth(token: string | undefined): { userId: number; username: string; displayName: string; roleId: number } {
  if (!token) {
    throw new Error('Authentication required');
  }
  const session = validateSession(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }
  return session;
}

export function requireOwner(token: string | undefined): { userId: number; username: string; displayName: string; roleId: number } {
  const session = requireAuth(token);
  const db = getDb();
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(session.roleId) as { name: string } | undefined;
  if (!role || role.name !== 'owner') {
    throw new Error('Owner privileges required');
  }
  return session;
}

export function registerIpcHandlers(_dbPath: string): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    const db = getDb();

    const adminExists = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get('admin') as { id: number; password_hash: string } | undefined;
    if (!adminExists) {
      const passwordHash = hashPassword('admin123');
      const now = new Date().toISOString();
      const ownerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('owner') as { id: number } | undefined;
      if (ownerRole) {
        db.prepare('INSERT INTO users (username, display_name, password_hash, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(
          'admin', 'المالك', passwordHash, ownerRole.id, now, now
        );
      }
      const bizCount = db.prepare('SELECT COUNT(*) as count FROM business').get() as { count: number };
      if (bizCount.count === 0) {
        db.prepare('INSERT INTO business (name_ar, name_en, created_at, updated_at, setup_complete) VALUES (?, ?, ?, ?, 1)').run('محل العطور', 'Perfume Shop', now, now);
      } else {
        db.prepare('UPDATE business SET setup_complete = 1, updated_at = ? WHERE id = 1').run(now);
      }
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username) as {
      id: number;
      username: string;
      display_name: string;
      password_hash: string;
      role_id: number;
    } | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new Error('Invalid credentials');
    }

    const token = createSession(user.id);

    const permissions = getUserPermissions(user.id);

    logAudit(user.id, 'login', 'user', user.id, `User ${user.username} logged in`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        roleId: user.role_id,
      },
      permissions,
    };
  });

  ipcMain.handle('auth:logout', async (_event, token: string) => {
    if (token) {
      const session = validateSession(token);
      if (session) {
        logAudit(session.userId, 'logout', 'user', session.userId, 'User logged out');
      }
      destroySession(token);
    }
  });

  ipcMain.handle('auth:changePassword', async (_event, userId: number, oldPassword: string, newPassword: string, token?: string) => {
    const session = requireAuth(token);

    if (session.userId !== userId) {
      const role = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(session.roleId) as { name: string } | undefined;
      if (!role || (role.name !== 'owner' && role.name !== 'admin')) {
        throw new Error('You can only change your own password');
      }
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;

    if (!user || !verifyPassword(oldPassword, user.password_hash)) {
      throw new Error('Current password is incorrect');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, new Date().toISOString(), userId);
    logAudit(session.userId, 'password_changed', 'user', userId, 'Password changed');
  });

  ipcMain.handle('auth:createInitialOwner', async (_event, data: { username: string; password: string; displayName: string }) => {
    const db = getDb();

    if (ownerCreated) {
      throw new Error('Owner account already created');
    }

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0) {
      throw new Error('Users already exist. Cannot create initial owner.');
    }

    const ownerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('owner') as { id: number } | undefined;
    if (!ownerRole) {
      throw new Error('Owner role not found');
    }

    if (!data.username || !data.password || !data.displayName) {
      throw new Error('Username, password, and display name are required');
    }
    if (data.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const passwordHash = hashPassword(data.password);
    const now = new Date().toISOString();

    db.prepare('INSERT INTO users (username, display_name, password_hash, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(
      data.username, data.displayName, passwordHash, ownerRole.id, now, now
    );

    ownerCreated = true;
    return true;
  });

  ipcMain.handle('auth:getCurrentUser', async (_event, token?: string) => {
    if (!token) return null;
    return validateSession(token);
  });

  ipcMain.handle('app:isFirstRun', async () => {
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const businessSetup = db.prepare('SELECT setup_complete FROM business WHERE id = 1').get() as { setup_complete: number } | undefined;
    return userCount.count === 0 || !businessSetup || businessSetup.setup_complete === 0;
  });

  ipcMain.handle('app:completeSetup', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const count = db.prepare('SELECT COUNT(*) as count FROM business').get() as { count: number };
    if (count.count === 0) {
      db.prepare('INSERT INTO business (name_ar, name_en, created_at, updated_at, setup_complete) VALUES (?, ?, ?, ?, 1)').run('محل العطور', 'Perfume Shop', now, now);
    } else {
      db.prepare('UPDATE business SET setup_complete = 1, updated_at = ? WHERE id = 1').run(now);
    }
  });

  ipcMain.handle('app:getVersion', async () => '1.1.0');
  ipcMain.handle('app:getDataPath', async () => require('path').join(require('electron').app.getPath('userData'), 'data'));

  registerProductHandlers();
  registerCategoryHandlers();
  registerBrandHandlers();
  registerCustomerHandlers();
  registerSupplierHandlers();
  registerPurchaseHandlers();
  registerSaleHandlers();
  registerCashHandlers();
  registerExpenseHandlers();
  registerProductionHandlers();
  registerAccountingHandlers();
  registerReportHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
  registerAuditHandlers();
  registerInventoryHandlers();
  registerUserHandlers();
  registerRoleHandlers();
  registerPrintHandlers();
  registerDiagnosticHandlers();
  registerExportHandlers();
  registerStoreSettingsHandlers();
}

function logAudit(userId: number | null, action: string, entity: string, entityId: number | null, details: string): void {
  const db = getDb();
  db.prepare('INSERT INTO audit_logs (user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    userId, action, entity, entityId, details, new Date().toISOString()
  );
}

export { logAudit };
