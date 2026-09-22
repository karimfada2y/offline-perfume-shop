import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysPath = path.join(__dirname, 'keys.json');

if (fs.existsSync(keysPath)) {
  console.log('keys.json already exists. Delete it first if you want to regenerate.');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(keysPath, JSON.stringify({ privateKey, publicKey }, null, 2));

console.log('=== KEYS GENERATED ===');
console.log('Private key saved to: keys.json (server-side only)');
console.log('');
console.log('=== EMBED THIS PUBLIC KEY IN THE DESKTOP CLIENT ===');
console.log(publicKey);
console.log('=== END PUBLIC KEY ===');
