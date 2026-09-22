import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency, formatDateTime } from '../utils/lib';
import { CashSession, CashMovement } from '../../shared/types';

export default function CashRegisterPage() {
  const { language, user } = useAuthStore();
  const [registers, setRegisters] = useState<Array<{ id: number; name: string }>>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showClosingReport, setShowClosingReport] = useState(false);
  const [closingReport, setClosingReport] = useState<Record<string, unknown> | null>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [reg, session] = await Promise.all([
      window.electronAPI.getCashRegisters() as Promise<Array<{ id: number; name: string }>>,
      window.electronAPI.getActiveCashSession() as Promise<CashSession | null>,
    ]);
    setRegisters(reg); setActiveSession(session);
    if (session) {
      setMovements(await window.electronAPI.getCashMovements(session.id) as CashMovement[]);
    }
    setLoading(false);
  };

  const handleOpen = async () => {
    if (!registers[0]) return;
    try {
      await window.electronAPI.openCashSession({ registerId: registers[0].id, openingCash: parseFloat(openingCash) || 0, userId: user?.id });
      setShowOpen(false); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    try {
      await window.electronAPI.closeCashSession(activeSession.id, { actualCash: parseFloat(actualCash) || 0, userId: user?.id });
      const report = await window.electronAPI.getClosingReport(activeSession.id) as Record<string, unknown>;
      setClosingReport(report);
      setShowClose(false);
      setShowClosingReport(true);
      loadData();
    } catch (e) { alert((e as Error).message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('cashRegister', language)}</h1>
        <div className="flex gap-2">
          {!activeSession ? (
            <button onClick={() => setShowOpen(true)} className="btn-primary text-sm">{t('openSession', language)}</button>
          ) : (
            <button onClick={() => setShowClose(true)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-sm">{t('closeSession', language)}</button>
          )}
        </div>
      </div>

      {activeSession ? (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-bold mb-4">{language === 'ar' ? 'جلسة مفتوحة' : 'Active Session'} - {activeSession.register_name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">{t('openingCash', language)}</p><p className="font-bold">{formatCurrency(activeSession.openingCash)}</p></div>
            <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">{language === 'ar' ? 'الوارد' : 'In'}</p><p className="font-bold text-green-600">{formatCurrency(movements.filter(m => ['SALE', 'CUSTOMER_PAYMENT', 'CASH_IN'].includes(m.type)).reduce((s, m) => s + m.amount, 0))}</p></div>
            <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">{language === 'ar' ? 'الصادر' : 'Out'}</p><p className="font-bold text-red-600">{formatCurrency(movements.filter(m => ['EXPENSE', 'REFUND', 'CASH_OUT', 'SUPPLIER_PAYMENT'].includes(m.type)).reduce((s, m) => s + m.amount, 0))}</p></div>
            <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">{language === 'ar' ? 'الصافي' : 'Net'}</p><p className="font-bold">{formatCurrency(movements.reduce((s, m) => s + m.amount, 0) + activeSession.openingCash)}</p></div>
          </div>
          <p className="text-xs text-muted-foreground">{t('openSession', language)}: {formatDateTime(activeSession.openedAt)}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد جلسة مفتوحة' : 'No active session'}</p>
        </div>
      )}

      {movements.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'النوع' : 'Type'}</th>
              <th className="p-3 text-right font-medium">{t('amount', language)}</th>
              <th className="p-3 text-right font-medium">{t('description', language)}</th>
              <th className="p-3 text-right font-medium">{t('date', language)}</th>
            </tr></thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-muted">{m.type}</span></td>
                  <td className={`p-3 font-medium ${m.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(m.amount)}</td>
                  <td className="p-3 text-muted-foreground">{m.description || '-'}</td>
                  <td className="p-3 text-xs">{formatDateTime(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('openSession', language)}</h3>
            <div className="mb-4"><label className="block text-sm font-medium mb-1">{t('openingCash', language)}</label><input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowOpen(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleOpen} className="flex-1 btn-primary text-sm">{t('confirm', language)}</button>
            </div>
          </div>
        </div>
      )}

      {showClose && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('closeSession', language)}</h3>
            <div className="mb-4"><label className="block text-sm font-medium mb-1">{t('closingCash', language)}</label><input type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" autoFocus /></div>
            {activeSession && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                <p>{t('expectedCash', language)}: {formatCurrency(activeSession.openingCash + movements.filter(m => ['SALE', 'CUSTOMER_PAYMENT', 'CASH_IN'].includes(m.type)).reduce((s, m) => s + m.amount, 0) - movements.filter(m => ['EXPENSE', 'REFUND', 'CASH_OUT', 'SUPPLIER_PAYMENT'].includes(m.type)).reduce((s, m) => s + m.amount, 0))}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowClose(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-sm">{t('closeSession', language)}</button>
            </div>
          </div>
        </div>
      )}

      {showClosingReport && closingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto" id="closing-report">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{language === 'ar' ? 'تقرير الإغلاق اليومي' : 'Daily Closing Report'}</h3>
              <button onClick={() => { setShowClosingReport(false); setClosingReport(null); }} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'الصندوق الافتتاحي' : 'Opening Cash'}</span>
                <span className="font-bold">{formatCurrency(closingReport.openingCash as number)}</span>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'مبيعات نقدي' : 'Cash Sales'}</span>
                <span className="font-bold text-green-600">{formatCurrency(closingReport.cashSales as number)}</span>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'مدفوعات العملاء' : 'Customer Payments'}</span>
                <span className="font-bold text-green-600">{formatCurrency(closingReport.cashPayments as number)}</span>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'وارد نقدي' : 'Cash In'}</span>
                <span className="font-bold text-green-600">{formatCurrency(closingReport.cashIn as number)}</span>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
                <span className="font-bold text-red-600">{formatCurrency(closingReport.expenses as number)}</span>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'المرتجعات' : 'Refunds'}</span>
                <span className="font-bold text-red-600">{formatCurrency(closingReport.refunds as number)}</span>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'صادر نقدي' : 'Cash Out'}</span>
                <span className="font-bold text-red-600">{formatCurrency(closingReport.cashOut as number)}</span>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg flex justify-between">
                <span>{language === 'ar' ? 'مدفوعات الموردين' : 'Supplier Payments'}</span>
                <span className="font-bold text-red-600">{formatCurrency(closingReport.supplierPayments as number)}</span>
              </div>
              <div className="border-t border-border pt-3 p-3 bg-primary/10 rounded-lg flex justify-between">
                <span className="font-bold">{t('expectedCash', language)}</span>
                <span className="font-bold text-lg">{formatCurrency(closingReport.expectedCash as number)}</span>
              </div>
            </div>

            {(closingReport.byPaymentMethod as Array<Record<string, unknown>>)?.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">{language === 'ar' ? 'حسب طريقة الدفع' : 'By Payment Method'}</h4>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'الطريقة' : 'Method'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'العدد' : 'Count'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr></thead>
                    <tbody>
                      {(closingReport.byPaymentMethod as Array<Record<string, unknown>>).map((pm, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3">{pm.payment_method as string}</td>
                          <td className="p-3">{pm.count as number}</td>
                          <td className="p-3 font-medium">{formatCurrency(pm.total as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowClosingReport(false); setClosingReport(null); }} className="btn-outline text-sm">{t('close', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
