import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatDateTime } from '../utils/lib';

export default function AuditPage() {
  const { language } = useAuthStore();
  const [logs, setLogs] = useState<Array<{ id: number; user_name: string; username: string; action: string; entity: string; entity_id: number; details: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => { loadLogs(); }, [entityFilter]);

  const loadLogs = async () => {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (entityFilter) filters.entity = entityFilter;
    setLogs(await window.electronAPI.getAuditLogs(filters) as Array<{ id: number; user_name: string; username: string; action: string; entity: string; entity_id: number; details: string; created_at: string }>);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('auditLog', language)}</h1>

      <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
        <option value="">{t('all', language)}</option>
        <option value="user">{language === 'ar' ? 'المستخدمين' : 'Users'}</option>
        <option value="sale">{t('sales', language)}</option>
        <option value="product">{t('products', language)}</option>
        <option value="purchase">{t('purchases', language)}</option>
        <option value="expense">{t('expenses', language)}</option>
      </select>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('date', language)}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'المستخدم' : 'User'}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'الإجراء' : 'Action'}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكيان' : 'Entity'}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
          </tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 text-xs">{formatDateTime(log.created_at)}</td>
                <td className="p-3">{log.user_name || log.username || '-'}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-muted">{log.action}</span></td>
                <td className="p-3">{log.entity} #{log.entity_id || ''}</td>
                <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">{log.details || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
