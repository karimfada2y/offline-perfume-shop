import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

export default function DiagnosticsPage() {
  const { language } = useAuthStore();
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.runDiagnostics() as Record<string, unknown>;
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('diagnostics', language)}</h1>
        <button onClick={runDiagnostics} disabled={loading} className="btn-primary text-sm disabled:opacity-50">
          {loading ? t('loading', language) : t('runDiagnostics', language)}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          <div className="card-modern p-4">
            <h3 className="font-bold mb-3">{t('databaseStatus', language)}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{t('databaseSize', language)}</span><span className="font-medium">{formatSize(results.databaseSize as number || 0)}</span></div>
              <div className="flex justify-between"><span>{language === 'ar' ? 'الإصدار' : 'Version'}</span><span className="font-medium">{results.version as string}</span></div>
              <div className="flex justify-between"><span>{t('integrityCheck', language)}</span><span className={`font-medium ${JSON.stringify(results.integrity) === '[{"integrity_check":"ok"}]' ? 'text-green-600' : 'text-red-600'}`}>{JSON.stringify(results.integrity) === '[{"integrity_check":"ok"}]' ? '✅ OK' : '❌ ' + JSON.stringify(results.integrity)}</span></div>
              <div className="flex justify-between"><span>{t('foreignKeysCheck', language)}</span><span className={`font-medium ${JSON.stringify(results.foreignKeys) === '[]' ? 'text-green-600' : 'text-red-600'}`}>{JSON.stringify(results.foreignKeys) === '[]' ? '✅ OK' : '❌ ' + JSON.stringify(results.foreignKeys)}</span></div>
            </div>
          </div>

          <div className="card-modern p-4">
            <h3 className="font-bold mb-3">{language === 'ar' ? 'الإحصائيات' : 'Statistics'}</h3>
            {(() => {
              const counts = results.counts as Record<string, number> | undefined;
              if (!counts) return null;
              return (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {Object.entries(counts).map(([key, val]) => (
                    <div key={key} className="p-2 bg-muted/50 rounded"><p className="text-xs text-muted-foreground">{key}</p><p className="font-bold">{String(val)}</p></div>
                  ))}
                </div>
              );
            })()}
          </div>

          {Array.isArray(results.unbalancedEntries) && results.unbalancedEntries.length > 0 && (
            <div className="card-modern p-4 border-red-500">
              <h3 className="font-bold mb-3 text-red-600">{t('unbalancedEntries', language)} ({results.unbalancedEntries.length})</h3>
              <div className="text-sm space-y-1">
                {(results.unbalancedEntries as Array<Record<string, unknown>>).slice(0, 5).map((e, i) => (
                  <p key={i}>#{String(e.entry_number)} - Debit: {String(e.total_debit)} / Credit: {String(e.total_credit)}</p>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(results.negativeStock) && results.negativeStock.length > 0 && (
            <div className="card-modern p-4 border-yellow-500">
              <h3 className="font-bold mb-3 text-yellow-600">{t('negativeStock', language)} ({results.negativeStock.length})</h3>
              <div className="text-sm space-y-1">
                {(results.negativeStock as Array<Record<string, unknown>>).map((p, i) => (
                  <p key={i}>{p.name_ar as string}: {p.current_stock as number}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
