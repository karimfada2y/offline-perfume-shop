import crypto from 'crypto';
import { execSync } from 'child_process';
import os from 'os';

function execWmic(command: string): string {
  try {
    const output = execSync(`wmic ${command}`, { encoding: 'utf8', timeout: 5000 });
    const lines = output.split('\n').filter(l => l.trim() && !l.includes(command.split(' ')[1]));
    return lines[0]?.trim() || '';
  } catch {
    return '';
  }
}

function getWindowsMachineId(): string {
  return execWmic('csproduct get UUID');
}

function getCpuId(): string {
  return execWmic('cpu get ProcessorId');
}

function getMotherboardSerial(): string {
  return execWmic('baseboard get SerialNumber');
}

export function generateDeviceFingerprint(): string {
  const components = [
    getWindowsMachineId(),
    getCpuId(),
    getMotherboardSerial(),
  ].filter(c => c.length > 0);

  if (components.length === 0) {
    const fallback = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown',
      os.totalmem().toString(),
    ].join('|');
    return crypto.createHash('sha256').update(fallback).digest('hex');
  }

  const combined = components.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex');
}

export function getShortDeviceId(): string {
  const fingerprint = generateDeviceFingerprint();
  return `DEVICE-${fingerprint.substring(0, 12).toUpperCase()}`;
}
