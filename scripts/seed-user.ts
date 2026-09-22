import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

const dbDir = path.join(app.getPath('userData'), 'data');
const dbPath = path.join(dbDir, 'shop.db');

if (!fs.existsSync(dbPath)) {
  console.error('No database found at', dbPath);
  process.exit(1);
}

const SQL = await initSqlJs();
const buffer = fs.readFileSync(dbPath);
const db = new SQL.Database(buffer);

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  return `${salt}:${hash.toString('hex')}`;
}

const existing = db.exec('SELECT COUNT(*) as count FROM users');
const count = existing[0]?.values[0]?.[0] || 0;
if (count > 0) {
  console.log('Users already exist:', count);
  process.exit(0);
}

const ownerRole = db.exec('SELECT id FROM roles WHERE name = "owner"');
const ownerId = ownerRole[0]?.values[0]?.[0];
if (!ownerId) {
  console.error('Owner role not found');
  process.exit(1);
}

const now = new Date().toISOString();
const passwordHash = hashPassword('admin123');

db.run(
  'INSERT INTO users (username, display_name, password_hash, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
  ['admin', 'المالك', passwordHash, ownerId, now, now]
);

const data = db.export();
fs.writeFileSync(dbPath, Buffer.from(data));

console.log('User created: admin / admin123');
