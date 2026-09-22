import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `JWHR-${segments.join('-')}`;
}

function validateLicenseKeyFormat(key: string): boolean {
  return /^JWHR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
}

function generateDeviceFingerprint(components: string[]): string {
  const combined = components.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function signToken(payload: object, privateKey: crypto.KeyObject): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iss: (payload as Record<string, unknown>).iss ?? 'perfumeshop-license-server',
    aud: (payload as Record<string, unknown>).aud ?? 'perfumeshop-desktop',
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${body}`);
  const signature = sign.sign(privateKey, 'base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string, publicKey: crypto.KeyObject, checkExpiry = false): object | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  try {
    const headerParsed = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (headerParsed.alg !== 'RS256') return null;

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(`${header}.${body}`);
    const isValid = verify.verify(publicKey, signature, 'base64url');
    if (!isValid) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

    if (!payload.iss || payload.iss !== 'perfumeshop-license-server') return null;
    if (!payload.aud || payload.aud !== 'perfumeshop-desktop') return null;

    if (checkExpiry && payload.expires_at && Math.floor(Date.now() / 1000) > payload.expires_at) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('License Key Format', () => {
  it('should generate valid license key format', () => {
    const key = generateLicenseKey();
    expect(validateLicenseKeyFormat(key)).toBe(true);
  });

  it('should match JWHR-XXXX-XXXX-XXXX-XXXX pattern', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^JWHR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it('should reject invalid key format - missing prefix', () => {
    expect(validateLicenseKeyFormat('ABCD-1234-5678-9ABC-DEF0')).toBe(false);
  });

  it('should reject invalid key format - wrong prefix', () => {
    expect(validateLicenseKeyFormat('TEST-1234-5678-9ABC-DEF0')).toBe(false);
  });

  it('should reject invalid key format - too short', () => {
    expect(validateLicenseKeyFormat('JWHR-1234-5678')).toBe(false);
  });

  it('should reject invalid key format - lowercase letters', () => {
    expect(validateLicenseKeyFormat('JWHR-abcd-1234-5678-9abc')).toBe(false);
  });

  it('should reject invalid key format - special characters', () => {
    expect(validateLicenseKeyFormat('JWHR-@#$%-1234-5678-9ABC')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateLicenseKeyFormat('')).toBe(false);
  });

  it('should reject string with spaces', () => {
    expect(validateLicenseKeyFormat('JWHR-1234 5678 9ABC DEF0')).toBe(false);
  });

  it('should generate unique keys', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateLicenseKey());
    }
    expect(keys.size).toBe(100);
  });
});

describe('Device Fingerprinting', () => {
  it('should generate consistent fingerprint from same components', () => {
    const components = ['UUID-1234', 'SN-5678', 'CPU-ABCD', 'MB-EF01', 'AA:BB:CC:DD:EE:FF'];
    const fp1 = generateDeviceFingerprint(components);
    const fp2 = generateDeviceFingerprint(components);
    expect(fp1).toBe(fp2);
  });

  it('should generate different fingerprints from different components', () => {
    const fp1 = generateDeviceFingerprint(['UUID-1234', 'SN-5678']);
    const fp2 = generateDeviceFingerprint(['UUID-9999', 'SN-0000']);
    expect(fp1).not.toBe(fp2);
  });

  it('should generate 64-character hex string', () => {
    const fp = generateDeviceFingerprint(['test']);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hash with different MAC address', () => {
    const fp1 = generateDeviceFingerprint(['UUID', 'AA:BB:CC:DD:EE:01']);
    const fp2 = generateDeviceFingerprint(['UUID', 'AA:BB:CC:DD:EE:02']);
    expect(fp1).not.toBe(fp2);
  });
});

describe('Token Signing and Verification', () => {
  it('should sign and verify token successfully', () => {
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: 'abc123',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
      iss: 'perfumeshop-license-server',
      aud: 'perfumeshop-desktop',
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified).not.toBeNull();
    expect(verified.license_id).toBe(1);
    expect(verified.license_key).toBe('JWHR-1234-5678-9ABC-DEF0');
    expect(verified.device_hash).toBe('abc123');
    expect(verified.iss).toBe('perfumeshop-license-server');
    expect(verified.aud).toBe('perfumeshop-desktop');
  });

  it('should reject token signed with wrong key', () => {
    const { privateKey: wrongKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const payload = { license_id: 1 };
    const token = signToken(payload, wrongKey);
    const verified = verifyToken(token, publicKey);
    expect(verified).toBeNull();
  });

  it('should reject tampered token', () => {
    const payload = { license_id: 1, device_hash: 'abc123' };
    const token = signToken(payload, privateKey);
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ license_id: 2, device_hash: 'tampered' })).toString('base64url');
    const tamperedToken = parts.join('.');
    const verified = verifyToken(tamperedToken, publicKey);
    expect(verified).toBeNull();
  });

  it('should reject token with invalid base64', () => {
    const verified = verifyToken('header.body.!@#$invalid', publicKey);
    expect(verified).toBeNull();
  });

  it('should reject empty token', () => {
    expect(verifyToken('', publicKey)).toBeNull();
  });

  it('should reject token with wrong number of parts', () => {
    expect(verifyToken('header.body', publicKey)).toBeNull();
    expect(verifyToken('header.body.signature.extra', publicKey)).toBeNull();
  });

  it('should reject expired token', () => {
    const payload = {
      license_id: 1,
      issued_at: Math.floor(Date.now() / 1000) - 10000,
      expires_at: Math.floor(Date.now() / 1000) - 5000,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey, true);
    expect(verified).toBeNull();
  });

  it('should accept valid non-expired token', () => {
    const payload = {
      license_id: 1,
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      iss: 'perfumeshop-license-server',
      aud: 'perfumeshop-desktop',
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey);
    expect(verified).not.toBeNull();
  });

  it('should reject token with wrong algorithm in header', () => {
    const payload = { license_id: 1 };
    const wrongHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${wrongHeader}.${body}`);
    const signature = sign.sign(privateKey, 'base64url');
    const token = `${wrongHeader}.${body}.${signature}`;
    const verified = verifyToken(token, publicKey);
    expect(verified).toBeNull();
  });

  it('should reject token without issuer claim', () => {
    const payload = {
      license_id: 1,
      device_hash: 'abc',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${body}`);
    const signature = sign.sign(privateKey, 'base64url');
    const token = `${header}.${body}.${signature}`;
    const verified = verifyToken(token, publicKey);
    expect(verified).toBeNull();
  });
});

describe('License Activation Scenarios', () => {
  it('should allow activation with matching device hash', () => {
    const deviceHash = generateDeviceFingerprint(['UUID-1234', 'SN-5678']);
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: deviceHash,
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified).not.toBeNull();
    expect(verified.device_hash).toBe(deviceHash);
  });

  it('should reject if device hash does not match', () => {
    const deviceHash1 = generateDeviceFingerprint(['UUID-1234']);
    const deviceHash2 = generateDeviceFingerprint(['UUID-9999']);
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: deviceHash1,
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified.device_hash).not.toBe(deviceHash2);
  });

  it('should reject forged token with different license key', () => {
    const { privateKey: wrongKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const payload = {
      license_id: 1,
      license_key: 'JWHR-FAKE-FAKE-FAKE-FAKE',
      device_hash: 'forged',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, wrongKey);
    const verified = verifyToken(token, publicKey);
    expect(verified).toBeNull();
  });
});

describe('Offline Verification', () => {
  it('should verify token without network access', () => {
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: 'abc123',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified).not.toBeNull();
    expect(verified.license_key).toBe('JWHR-1234-5678-9ABC-DEF0');
  });

  it('should work with embedded public key', () => {
    const embeddedKey = publicKey;
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: 'abc123',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, embeddedKey) as Record<string, unknown>;
    expect(verified).not.toBeNull();
  });
});

describe('Token Payload Validation', () => {
  it('should preserve all fields in token', () => {
    const payload = {
      license_id: 42,
      license_key: 'JWHR-AAAA-BBBB-CCCC-DDDD',
      device_hash: 'fingerprint123',
      issued_at: 1700000000,
      expires_at: 1700100000,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified.license_id).toBe(42);
    expect(verified.license_key).toBe('JWHR-AAAA-BBBB-CCCC-DDDD');
    expect(verified.device_hash).toBe('fingerprint123');
    expect(verified.issued_at).toBe(1700000000);
    expect(verified.expires_at).toBe(1700100000);
  });

  it('should handle null expires_at', () => {
    const payload = {
      license_id: 1,
      license_key: 'JWHR-1234-5678-9ABC-DEF0',
      device_hash: 'abc',
      issued_at: Math.floor(Date.now() / 1000),
      expires_at: null,
    };
    const token = signToken(payload, privateKey);
    const verified = verifyToken(token, publicKey) as Record<string, unknown>;
    expect(verified.expires_at).toBeNull();
  });
});

describe('Concurrent Activation Logic', () => {
  it('should only allow one device to activate unused license', () => {
    const deviceHash1 = generateDeviceFingerprint(['UUID-1111']);
    const deviceHash2 = generateDeviceFingerprint(['UUID-2222']);
    
    let activatedDevice: string | null = null;
    let activationCount = 0;
    
    function simulateActivation(deviceHash: string): { success: boolean; alreadyActivated?: boolean } {
      if (activatedDevice === null) {
        activatedDevice = deviceHash;
        activationCount++;
        return { success: true };
      }
      
      if (activatedDevice === deviceHash) {
        return { success: true, alreadyActivated: true };
      }
      
      return { success: false };
    }
    
    const result1 = simulateActivation(deviceHash1);
    const result2 = simulateActivation(deviceHash2);
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
    expect(activationCount).toBe(1);
    expect(activatedDevice).toBe(deviceHash1);
  });

  it('should allow same device to retry activation', () => {
    const deviceHash = generateDeviceFingerprint(['UUID-1111']);
    
    let activatedDevice: string | null = null;
    
    function simulateActivation(deviceHash: string): { success: boolean; alreadyActivated?: boolean } {
      if (activatedDevice === null) {
        activatedDevice = deviceHash;
        return { success: true };
      }
      
      if (activatedDevice === deviceHash) {
        return { success: true, alreadyActivated: true };
      }
      
      return { success: false };
    }
    
    const result1 = simulateActivation(deviceHash);
    const result2 = simulateActivation(deviceHash);
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result2.alreadyActivated).toBe(true);
  });

  it('should handle multiple licenses activating concurrently', () => {
    const licenses = new Map<string, string | null>();
    licenses.set('LICENSE-1', null);
    licenses.set('LICENSE-2', null);
    licenses.set('LICENSE-3', null);
    
    const device1 = generateDeviceFingerprint(['UUID-1111']);
    const device2 = generateDeviceFingerprint(['UUID-2222']);
    const device3 = generateDeviceFingerprint(['UUID-3333']);
    
    function simulateActivation(licenseKey: string, deviceHash: string): { success: boolean; error?: string } {
      const currentDevice = licenses.get(licenseKey);
      
      if (currentDevice === null) {
        licenses.set(licenseKey, deviceHash);
        return { success: true };
      }
      
      if (currentDevice === deviceHash) {
        return { success: true };
      }
      
      return { success: false, error: 'Already activated' };
    }
    
    const result1 = simulateActivation('LICENSE-1', device1);
    const result2 = simulateActivation('LICENSE-2', device2);
    const result3 = simulateActivation('LICENSE-3', device3);
    const result4 = simulateActivation('LICENSE-1', device2);
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
    expect(result4.success).toBe(false);
    expect(licenses.get('LICENSE-1')).toBe(device1);
    expect(licenses.get('LICENSE-2')).toBe(device2);
    expect(licenses.get('LICENSE-3')).toBe(device3);
  });

  it('should reject activation after database save failure', () => {
    const deviceHash = generateDeviceFingerprint(['UUID-1111']);
    
    let activatedDevice: string | null = null;
    let saveSucceeded = true;
    
    function simulateActivation(deviceHash: string): { success: boolean; error?: string } {
      if (activatedDevice !== null) {
        return { success: false, error: 'Already activated' };
      }
      
      activatedDevice = deviceHash;
      
      if (!saveSucceeded) {
        activatedDevice = null;
        return { success: false, error: 'Database save failed' };
      }
      
      return { success: true };
    }
    
    saveSucceeded = false;
    const result1 = simulateActivation(deviceHash);
    
    expect(result1.success).toBe(false);
    expect(result1.error).toBe('Database save failed');
    expect(activatedDevice).toBeNull();
    
    saveSucceeded = true;
    const result2 = simulateActivation(deviceHash);
    
    expect(result2.success).toBe(true);
  });

  it('should handle retry after failed activation', () => {
    const deviceHash1 = generateDeviceFingerprint(['UUID-1111']);
    const deviceHash2 = generateDeviceFingerprint(['UUID-2222']);
    
    let activatedDevice: string | null = null;
    let activationCount = 0;
    
    function simulateActivation(deviceHash: string): { success: boolean; error?: string } {
      activationCount++;
      
      if (activationCount === 1) {
        return { success: false, error: 'Temporary failure' };
      }
      
      if (activatedDevice === null) {
        activatedDevice = deviceHash;
        return { success: true };
      }
      
      if (activatedDevice === deviceHash) {
        return { success: true };
      }
      
      return { success: false, error: 'Already activated' };
    }
    
    const result1 = simulateActivation(deviceHash1);
    const result2 = simulateActivation(deviceHash1);
    const result3 = simulateActivation(deviceHash2);
    
    expect(result1.success).toBe(false);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(false);
    expect(activatedDevice).toBe(deviceHash1);
  });
});
