import initSqlJs from 'sql.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'licenses.db');
const KEYS_PATH = path.join(__dirname, 'keys.json');

let db;
let keys;

const activationLocks = new Map();

async function acquireActivationLock(licenseKey) {
  while (activationLocks.has(licenseKey)) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  activationLocks.set(licenseKey, true);
}

function releaseActivationLock(licenseKey) {
  activationLocks.delete(licenseKey);
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'unused',
      device_hash TEXT,
      activated_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activation_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      license_key TEXT,
      device_hash TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      event_type TEXT NOT NULL,
      license_key_hash TEXT,
      device_hash_hash TEXT,
      ip_address TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      details TEXT
    )
  `);

  saveDatabase();
  return db;
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function loadOrCreateKeys() {
  if (fs.existsSync(KEYS_PATH)) {
    const data = fs.readFileSync(KEYS_PATH, 'utf8');
    keys = JSON.parse(data);
    return keys;
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  keys = { privateKey, publicKey };
  fs.writeFileSync(KEYS_PATH, JSON.stringify({ privateKey, publicKey }, null, 2));

  return keys;
}

export function getKeys() {
  return keys;
}

export function getDb() {
  return db;
}

export function createLicense(licenseKey, options = {}) {
  db.run(
    `INSERT INTO licenses (license_key, status, expires_at, created_at, updated_at)
     VALUES (?, 'unused', ?, datetime('now'), datetime('now'))`,
    [licenseKey, options.expiresAt || null]
  );
  saveDatabase();
}

export function findLicense(licenseKey) {
  const stmt = db.prepare(`SELECT * FROM licenses WHERE license_key = ?`);
  stmt.bind([licenseKey]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function activateLicense(licenseKey, deviceHash) {
  const changesBefore = db.getRowsModified();
  db.run(
    `UPDATE licenses
     SET status = 'activated', device_hash = ?, activated_at = datetime('now'), updated_at = datetime('now')
     WHERE license_key = ? AND status = 'unused'`,
    [deviceHash, licenseKey]
  );
  const changes = db.getRowsModified();
  saveDatabase();
  return { changes };
}

export function validateLicense(licenseKey, deviceHash) {
  const stmt = db.prepare(
    `SELECT * FROM licenses
     WHERE license_key = ? AND status = 'activated' AND device_hash = ?`
  );
  stmt.bind([licenseKey, deviceHash]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function logAttempt(ipAddress, licenseKey, deviceHash, success) {
  db.run(
    `INSERT INTO activation_attempts (ip_address, license_key, device_hash, success, attempted_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [ipAddress, licenseKey, deviceHash, success ? 1 : 0]
  );
  saveDatabase();
}

export function checkRateLimit(ipAddress, maxAttempts = 5, windowMinutes = 15) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const stmt = db.prepare(
    `SELECT COUNT(*) as count
     FROM activation_attempts
     WHERE ip_address = ? AND attempted_at > ? AND success = 0`
  );
  stmt.bind([ipAddress, windowStart]);
  let count = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    count = row.count || 0;
  }
  stmt.free();
  return count < maxAttempts;
}

export async function activateLicenseAtomically(licenseKey, deviceHash) {
  await acquireActivationLock(licenseKey);
  
  try {
    const license = findLicense(licenseKey);
    
    if (!license) {
      return { success: false, error: 'Invalid license key.' };
    }
    
    if (license.status === 'activated') {
      if (license.device_hash === deviceHash) {
        return { success: true, alreadyActivated: true, license };
      }
      return { success: false, error: 'License already activated on another device.' };
    }
    
    const result = activateLicense(licenseKey, deviceHash);
    
    if (result.changes === 0) {
      return { success: false, error: 'Failed to activate license.' };
    }
    
    const updatedLicense = findLicense(licenseKey);
    return { success: true, license: updatedLicense };
    
  } finally {
    releaseActivationLock(licenseKey);
  }
}

export function logAuditEvent(eventType, licenseKeyHash, deviceHashHash, ipAddress, success, details) {
  try {
    const sanitizedDetails = typeof details === 'string' 
      ? details.replace(/[\n\r\t]/g, ' ').substring(0, 500) 
      : '';
    
    db.run(
      `INSERT INTO audit_log (timestamp, event_type, license_key_hash, device_hash_hash, ip_address, success, details)
       VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)`,
      [eventType, licenseKeyHash || null, deviceHashHash || null, ipAddress || null, success ? 1 : 0, sanitizedDetails]
    );
    saveDatabase();
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}
