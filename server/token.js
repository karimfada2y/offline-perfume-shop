import crypto from 'crypto';
import { getKeys } from './database.js';

const ISSUER = 'perfumeshop-license-server';
const AUDIENCE = 'perfumeshop-desktop';

export function signToken(payload) {
  const { privateKey } = getKeys();

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iss: ISSUER,
    aud: AUDIENCE,
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${body}`);
  const signature = sign.sign(privateKey, 'base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  const { publicKey } = getKeys();

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

    if (payload.iss !== ISSUER) return null;
    if (payload.aud !== AUDIENCE) return null;

    if (payload.exp && Date.now() > payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getPublicKey() {
  return getKeys().publicKey;
}
