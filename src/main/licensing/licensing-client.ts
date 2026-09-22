import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { generateDeviceFingerprint } from './device-fingerprint.js';

const isProduction = app.isPackaged;

const LICENSE_SERVER_URL = isProduction
  ? 'https://alex-perfume-production.up.railway.app'
  : (process.env.DEV_LICENSE_SERVER_URL || 'http://localhost:3000');

const TOKEN_FILENAME = 'activation.token';

const EMBEDDED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr76pXCCh/Lq25MqZO+Y8
Qm+gYONcYG5+U1VU7HqvAvqklfBVQz+yCvoHZf8kKiw0dHeWyp53cjaYt+Y8GezN
rvj8Eyv4xnkM8cqleGPsqjZuVa4ksjO9+ytzJfuPgC56mVq3u3McN1aL8i/qd+h0
YFLrtjY4HdSLkt/9oHVm8ixeVX3PYA6sbQ5GJwxEUu7gf1RELBkDWYP4oU1DgY70
M+3BPqufolI+EsaVUHdw+UAWXYsDy7iPfsDGMwbswPZqrZ25DlvPWGrIhX0lwRvZ
uoK1Howh5RfuJXLneZVvE8IEea1zMyhUbmJUwYUWO8ydwXQ1NnYdRNPXH50/yrWj
GwIDAQAB
-----END PUBLIC KEY-----`;

function getLicenseDir(): string {
  const dir = path.join(app.getPath('userData'), 'license');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getTokenPath(): string {
  return path.join(getLicenseDir(), TOKEN_FILENAME);
}

export interface LicenseToken {
  license_id: number;
  license_key: string;
  device_hash: string;
  issued_at: number;
  expires_at: number | null;
  iss?: string;
  aud?: string;
}

export interface ActivationResult {
  success: boolean;
  message?: string;
  error?: string;
}

const LICENSE_KEY_REGEX = /^JWHR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

function validateLicenseKeyFormat(key: string): boolean {
  return LICENSE_KEY_REGEX.test(key);
}

function normalizeLicenseKey(key: string): string {
  return key.toUpperCase().trim().replace(/\s+/g, '');
}

function verifyTokenSignature(token: string): LicenseToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, bodyB64, signatureB64] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    if (header.alg !== 'RS256') return null;
    if (header.typ !== 'JWT') return null;

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(`${headerB64}.${bodyB64}`);
    const isValid = verify.verify(EMBEDDED_PUBLIC_KEY, signatureB64, 'base64url');

    if (!isValid) return null;

    const payload: LicenseToken = JSON.parse(Buffer.from(bodyB64, 'base64url').toString());

    if (!payload.iss || payload.iss !== 'perfumeshop-license-server') return null;
    if (!payload.aud || payload.aud !== 'perfumeshop-desktop') return null;

    if (payload.expires_at && Math.floor(Date.now() / 1000) > payload.expires_at) {
      return null;
    }

    if (!payload.license_key || !payload.device_hash || !payload.license_id) return null;

    return payload;
  } catch {
    return null;
  }
}

export function hasValidLocalActivation(): boolean {
  try {
    const tokenPath = getTokenPath();

    if (!fs.existsSync(tokenPath)) return false;

    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    const payload = verifyTokenSignature(token);
    if (!payload) return false;

    const deviceFingerprint = generateDeviceFingerprint();
    if (payload.device_hash !== deviceFingerprint) return false;

    return true;
  } catch {
    return false;
  }
}

export function getLocalToken(): LicenseToken | null {
  try {
    const tokenPath = getTokenPath();

    if (!fs.existsSync(tokenPath)) return null;

    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    return verifyTokenSignature(token);
  } catch {
    return null;
  }
}

export async function activateLicense(licenseKey: string): Promise<ActivationResult> {
  const normalized = normalizeLicenseKey(licenseKey);

  if (!validateLicenseKeyFormat(normalized)) {
    return { success: false, error: 'Invalid license key format.' };
  }

  const deviceFingerprint = generateDeviceFingerprint();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${LICENSE_SERVER_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: normalized,
        device_hash: deviceFingerprint,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json() as { error?: string; token?: string; message?: string };

    if (!response.ok) {
      return { success: false, error: data.error || 'Activation failed.' };
    }

    if (data.token) {
      const payload = verifyTokenSignature(data.token);
      if (!payload) {
        return { success: false, error: 'Activation failed: invalid server response.' };
      }

      const tokenPath = getTokenPath();
      fs.writeFileSync(tokenPath, data.token, 'utf8');
    }

    return { success: true, message: data.message };

  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return { success: false, error: 'Activation timed out. Please check your internet connection and try again.' };
    }
    if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('ENOTFOUND')) {
      return { success: false, error: 'Internet connection is required for first-time activation. Please connect to the internet and try again.' };
    }
    return { success: false, error: 'Activation failed. Please try again.' };
  }
}

export function clearActivation(): void {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  } catch {
    // ignore
  }
}
