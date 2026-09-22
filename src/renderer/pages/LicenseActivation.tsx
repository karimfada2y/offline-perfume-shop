import React, { useState, useEffect } from 'react';
import { t, Language } from '../i18n';
import '../../shared/types/electron-api';

export default function LicenseActivation() {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('ar');
  const [deviceId, setDeviceId] = useState('');
  const [step, setStep] = useState<'input' | 'activating' | 'success'>('input');

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    async function loadDeviceId() {
      try {
        const result = await window.electronAPI.checkActivation();
        setDeviceId(result.deviceId);
      } catch {
        // ignore
      }
    }
    loadDeviceId();
  }, [language]);

  const formatKeyInput = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const parts = cleaned.split('-');
    if (parts.length > 5) return licenseKey;

    if (parts.length >= 2 && parts[0] !== 'JWHR') {
      return 'JWHR-' + cleaned.replace('JWHR-', '');
    }

    return cleaned;
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStep('activating');

    try {
      const result = await window.electronAPI.activateLicense(licenseKey.trim());

      if (result.success) {
        setStep('success');
        setTimeout(() => {
          window.electronAPI.notifyActivated();
        }, 1500);
      } else {
        setError(result.error || t('activationFailed', language));
        setStep('input');
      }
    } catch {
      setError(t('activationError', language));
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-green-500/10 to-background">
        <div className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl border border-border text-center">
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">{t('activationSuccess', language)}</h2>
          <p className="text-muted-foreground">{t('activatingApp', language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-background">
      <div className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl border border-border">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">&#127800;</div>
          <h1 className="text-2xl font-bold text-primary">{t('appName', language)}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('activationRequired', language)}</p>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('licenseKey', language)}</label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(formatKeyInput(e.target.value))}
              placeholder="JWHR-XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground font-mono text-center tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
              required
              autoFocus
              maxLength={24}
            />
            <p className="text-xs text-muted-foreground mt-1 text-center">
              {t('licenseKeyFormat', language)}
            </p>
          </div>

          {deviceId && (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <span className="font-medium">{t('yourDeviceId', language)}: </span>
              <code className="font-mono text-primary">{deviceId}</code>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || licenseKey.length < 20}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? t('activating', language) : t('activate', language)}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  );
}
