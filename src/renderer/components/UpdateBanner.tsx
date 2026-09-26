import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { UpdateStatus } from '../../shared/types/electron-api';

const DISMISSED_KEY = 'updateBannerDismissed';

export default function UpdateBanner() {
  const { language } = useAuthStore();
  const ar = language === 'ar';
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onUpdateStatus((next) => {
      setStatus(next);
    });
    window.electronAPI.getUpdateStatus().then(setStatus).catch(() => undefined);
    return unsubscribe;
  }, []);

  const version = status?.version;
  const isUpdate = status?.state === 'available' || status?.state === 'downloading' || status?.state === 'downloaded';

  useEffect(() => {
    if (version && isUpdate) {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY));
    }
  }, [version, isUpdate]);

  const dismiss = useCallback(() => {
    if (version) {
      window.localStorage.setItem(DISMISSED_KEY, version);
    }
    setDismissed(version ?? null);
  }, [version]);

  if (!status || !isUpdate || !version) return null;
  if (dismissed === version) return null;

  const handleDownload = () => {
    if (status.state === 'available') {
      window.electronAPI.downloadUpdate();
    } else if (status.state === 'downloaded') {
      window.electronAPI.installUpdate();
    }
  };

  const downloading = status.state === 'downloading';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="rounded-xl border border-border bg-card shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">
              {ar ? 'يتوفر تحديث جديد' : 'A new update is available'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar ? `الإصدار ${version}` : `Version ${version}`}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
            aria-label={ar ? 'إغلاق' : 'Dismiss'}
          >
            &times;
          </button>
        </div>

        {downloading && (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${status.percent ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {ar ? 'جاري التحميل' : 'Downloading'} {status.percent ?? 0}%
              {status.message ? ` — ${status.message}` : ''}
            </p>
          </div>
        )}

        {status.state === 'downloaded' && (
          <p className="text-xs text-muted-foreground mt-2">
            {ar ? 'التحديث جاهز، سيتم إعادة تشغيل البرنامج' : 'Update ready, the app will restart'}
          </p>
        )}

        {!downloading && (
          <div className="mt-3 flex gap-2 justify-end">
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted"
            >
              {ar ? 'لاحقاً' : 'Later'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
            >
              {status.state === 'downloaded'
                ? (ar ? 'تثبيت الآن' : 'Install now')
                : (ar ? 'تحميل' : 'Download')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
