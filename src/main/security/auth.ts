import crypto from 'crypto';
import { getDb } from '../database/wrapper';

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, DIGEST);
  return `${salt}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, DIGEST);
  const hashBuf = Buffer.from(hash, 'hex');
  const verifyBuf = Buffer.from(verifyHash.toString('hex'), 'hex');
  if (hashBuf.length !== verifyBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, verifyBuf);
}

export function createSession(userId: number): string {
  const db = getDb();
  const token = crypto.randomBytes(48).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (user_id, token, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, token, now, expiresAt);

  return token;
}

export function validateSession(token: string): { userId: number; username: string; displayName: string; roleId: number } | null {
  const db = getDb();
  const session = db.prepare(`
    SELECT s.user_id, u.username, u.display_name, u.role_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as { user_id: number; username: string; display_name: string; role_id: number } | undefined;

  if (!session) return null;

  return {
    userId: session.user_id,
    username: session.username,
    displayName: session.display_name,
    roleId: session.role_id,
  };
}

export function destroySession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserPermissions(userId: number): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.name
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN users u ON u.role_id = rp.role_id
    WHERE u.id = ?
  `).all(userId) as { name: string }[];

  return rows.map(r => r.name);
}
