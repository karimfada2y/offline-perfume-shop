import { ipcMain } from 'electron';
import { activateLicense, hasValidLocalActivation } from '../licensing/licensing-client.js';
import { getShortDeviceId } from '../licensing/device-fingerprint.js';

export function registerLicensingHandlers(): void {
  ipcMain.handle('licensing:activate', async (_event, licenseKey: unknown) => {
    if (typeof licenseKey !== 'string') {
      return { success: false, error: 'Invalid input.' };
    }
    const sanitized = licenseKey.trim().substring(0, 30);
    return activateLicense(sanitized);
  });

  ipcMain.handle('licensing:checkActivation', async () => {
    return {
      activated: hasValidLocalActivation(),
      deviceId: getShortDeviceId(),
    };
  });
}
