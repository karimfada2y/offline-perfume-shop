import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { initDatabase, loadOrCreateKeys, findLicense, validateLicense, logAttempt, checkRateLimit, createLicense, activateLicenseAtomically, logAuditEvent } from './database.js';
import { signToken, getPublicKey } from './token.js';

const PORT = process.env.PORT || 3000;

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1kb' }));

const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many activation attempts.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const createLicenseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many license creation requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const KEY_REGEX = /^JWHR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `JWHR-${segments.join('-')}`;
}

function hashForLog(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
}

app.post('/activate', activationLimiter, async (req, res) => {
  try {
    const { license_key, device_hash } = req.body;

    if (!license_key || !device_hash || typeof license_key !== 'string' || typeof device_hash !== 'string') {
      logAuditEvent('malformed_request', null, null, req.ip, false, 'Invalid request body');
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const normalizedKey = license_key.toUpperCase().trim();
    if (!KEY_REGEX.test(normalizedKey)) {
      logAttempt(req.ip, normalizedKey, device_hash, false);
      logAuditEvent('invalid_license', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, false, 'Invalid key format');
      return res.status(400).json({ error: 'Invalid license key.' });
    }

    if (device_hash.length !== 64 || !/^[a-f0-9]+$/.test(device_hash)) {
      logAuditEvent('malformed_request', hashForLog(normalizedKey), null, req.ip, false, 'Invalid device hash format');
      return res.status(400).json({ error: 'Invalid request.' });
    }

    if (!checkRateLimit(req.ip)) {
      logAuditEvent('rate_limit', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, false, 'Rate limit exceeded');
      return res.status(429).json({ error: 'Too many activation attempts.' });
    }

    const result = await activateLicenseAtomically(normalizedKey, device_hash);

    if (!result.success) {
      logAttempt(req.ip, normalizedKey, device_hash, false);
      
      if (result.error === 'License already activated on another device.') {
        logAuditEvent('already_activated', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, false, 'Different device');
        return res.status(403).json({ error: result.error });
      }
      
      logAuditEvent('activation_failed', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, false, result.error);
      return res.status(400).json({ error: result.error });
    }

    if (result.alreadyActivated) {
      const tokenPayload = {
        license_id: result.license.id,
        license_key: result.license.license_key,
        device_hash: result.license.device_hash,
        issued_at: Math.floor(Date.now() / 1000),
        expires_at: result.license.expires_at ? Math.floor(new Date(result.license.expires_at).getTime() / 1000) : null,
      };
      const token = signToken(tokenPayload);
      logAttempt(req.ip, normalizedKey, device_hash, true);
      logAuditEvent('activation_success', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, true, 'Already activated on this device');
      return res.json({ success: true, token, message: 'License already activated on this device.' });
    }

    const tokenPayload = {
      license_id: result.license.id,
      license_key: result.license.license_key,
      device_hash: device_hash,
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: result.license.expires_at ? Math.floor(new Date(result.license.expires_at).getTime() / 1000) : null,
    };
    const token = signToken(tokenPayload);

    logAttempt(req.ip, normalizedKey, device_hash, true);
    logAuditEvent('activation_success', hashForLog(normalizedKey), hashForLog(device_hash), req.ip, true, 'New activation');
    return res.json({ success: true, token, message: 'License activated successfully.' });

  } catch (error) {
    console.error('Activation error:', error);
    logAuditEvent('server_error', null, null, req.ip, false, 'Internal error');
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/validate', (req, res) => {
  try {
    const { license_key, device_hash } = req.body;

    if (!license_key || !device_hash || typeof license_key !== 'string' || typeof device_hash !== 'string') {
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const license = validateLicense(license_key, device_hash);

    if (!license) {
      logAuditEvent('validation_failed', hashForLog(license_key), hashForLog(device_hash), req.ip, false, 'License not found');
      return res.status(404).json({ valid: false, error: 'License not found.' });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      logAuditEvent('validation_failed', hashForLog(license_key), hashForLog(device_hash), req.ip, false, 'License expired');
      return res.json({ valid: false, error: 'License expired.' });
    }

    return res.json({ valid: true, message: 'License is valid.' });

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/public-key', (_req, res) => {
  res.json({ publicKey: getPublicKey() });
});

app.post('/create-license', createLicenseLimiter, (req, res) => {
  try {
    const { admin_key, count = 1, expires_at } = req.body;

    if (!admin_key || typeof admin_key !== 'string') {
      logAuditEvent('admin_action', null, null, req.ip, false, 'Missing admin key');
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    if (admin_key !== process.env.ADMIN_KEY) {
      logAuditEvent('admin_action', null, null, req.ip, false, 'Invalid admin key');
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const numLicenses = Math.min(Math.max(1, Math.floor(Number(count) || 1)), 50);

    if (expires_at && (typeof expires_at !== 'string' || isNaN(new Date(expires_at).getTime()))) {
      return res.status(400).json({ error: 'Invalid expiration date.' });
    }

    const licenses = [];
    for (let i = 0; i < numLicenses; i++) {
      const key = generateLicenseKey();
      createLicense(key, { expires_at });
      licenses.push(key);
    }

    logAuditEvent('license_created', null, null, req.ip, true, `Created ${numLicenses} license(s)`);
    return res.json({ success: true, licenses });

  } catch (error) {
    console.error('License creation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  await initDatabase();
  loadOrCreateKeys();

  if (!process.env.ADMIN_KEY) {
    console.error('FATAL: ADMIN_KEY environment variable is required.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`License server running on HTTP port ${PORT}`);
  });
}

startServer();

export { app, startServer };
