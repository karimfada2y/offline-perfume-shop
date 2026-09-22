import crypto from 'crypto';
import { initDatabase, loadOrCreateKeys, createLicense } from './database.js';

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `JWHR-${segments.join('-')}`;
}

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    console.error('Error: ADMIN_KEY environment variable is required');
    console.error('Usage: ADMIN_KEY=your-secret-key node create-license.js [count]');
    process.exit(1);
  }

  await initDatabase();
  loadOrCreateKeys();

  const licenses = [];
  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    createLicense(key);
    licenses.push(key);
  }

  console.log(`Created ${licenses.length} license(s):`);
  licenses.forEach(key => console.log(`  ${key}`));
}

main();
