import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency, formatDateTime } from '../utils/lib';
import { Supplier } from '../../shared/types';
import { useDebounceValue } from '../hooks/useDebounceValue';

interface Transaction {
  id: number;
  supplierId: number;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  created_at: string;
}

export default function SuppliersPage() {
  const { language } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [form, setForm] = useState<Record<string, unknown>>({
    nameAr: '', nameEn: '', phone: '', whatsapp: '', address: '', notes: '', openingBalance: 0,
  });
  const debouncedSearch = useDebounceValue(search, 200);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setSuppliers(await window.electronAPI.getSuppliers() as Supplier[]);
    setLoading(false);
  };

  const filtered = useMemo(() => suppliers.filter(s =>
    s.nameAr.includes(debouncedSearch) || (s.nameEn && s.nameEn.includes(debouncedSearch)) || (s.phone && s.phone.includes(debouncedSearch))
  ), [suppliers, debouncedSearch]);

  const handleSave = async () => {
    try {
      if (editSupplier) { await window.electronAPI.updateSupplier(editSupplier.id, form); }
      else { await window.electronAPI.createSupplier(form); }
      setShowForm(false); setEditSupplier(null); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  const openStatement = async (s: Supplier) => {
    setStatementSupplier(s);
    setShowStatement(true);
    setStatementLoading(true);
    try {
      const txns = await window.electronAPI.getSupplierTransactions(s.id) as Transaction[];
      setTransactions(txns);
    } catch { setTransactions([]); }
    setStatementLoading(false);
  };

  const filteredTransactions = transactions.filter(tx => {
    if (statementDateFrom && tx.created_at < statementDateFrom) return false;
    if (statementDateTo && tx.created_at > statementDateTo + 'T23:59:59') return false;
    return true;
  });

  const txTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      OPENING_BALANCE: language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance',
      PURCHASE: language === 'ar' ? 'شراء' : 'Purchase',
      PAYMENT: language === 'ar' ? 'دفعة' : 'Payment',
      PURCHASE_RETURN: language === 'ar' ? 'مرتجع شراء' : 'Purchase Return',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('suppliers', language)}</h1>
        <button onClick={() => { setForm({ nameAr: '', nameEn: '', phone: '', whatsapp: '', address: '', notes: '', openingBalance: 0 }); setEditSupplier(null); setShowForm(true); }} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search', language) + '...'} className="input-field" />

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
            <th className="p-3 text-right font-medium">{t('phone', language)}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
            <th className="p-3 text-right font-medium">{t('actions', language)}</th>
          </tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 font-medium">{s.nameAr}</td>
                <td className="p-3">{s.phone || '-'}</td>
                <td className={`p-3 font-medium ${s.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(s.currentBalance)}</td>
                <td className="p-3 space-x-2">
                  <button onClick={() => { setForm({ nameAr: s.nameAr, nameEn: s.nameEn || '', phone: s.phone || '', whatsapp: s.whatsapp || '', address: s.address || '', notes: s.notes || '', openingBalance: s.openingBalance }); setEditSupplier(s); setShowForm(true); }} className="text-primary hover:underline text-sm">{t('edit', language)}</button>
                  <button onClick={() => openStatement(s)} className="text-primary hover:underline text-sm">{language === 'ar' ? 'كشف حساب' : 'Statement'}</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t('noSuppliers', language)}</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{editSupplier ? t('edit', language) : t('add', language)} {t('suppliers', language)}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">{t('productNameAr', language)}</label><input value={form.nameAr as string} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('productNameEn', language)}</label><input value={form.nameEn as string} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('phone', language)}</label><input value={form.phone as string} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('whatsapp', language)}</label><input value={form.whatsapp as string} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('address', language)}</label><input value={form.address as string} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowForm(false); setEditSupplier(null); }} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} className="flex-1 btn-primary text-sm">{t('save', language)}</button>
            </div>
          </div>
        </div>
      )}

      {showStatement && statementSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{language === 'ar' ? 'كشف حساب' : 'Statement'} - {statementSupplier.nameAr}</h3>
              <button onClick={() => { setShowStatement(false); setStatementSupplier(null); setTransactions([]); }} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</p>
                <p className={`font-bold ${statementSupplier.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(statementSupplier.currentBalance)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{language === 'ar' ? 'عدد المعاملات' : 'Transactions'}</p>
                <p className="font-bold">{filteredTransactions.length}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</p>
                <p className="font-bold">{formatCurrency(statementSupplier.openingBalance)}</p>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="date" value={statementDateFrom} onChange={(e) => setStatementDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <span className="py-2">{language === 'ar' ? 'إلى' : 'to'}</span>
              <input type="date" value={statementDateTo} onChange={(e) => setStatementDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            {statementLoading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="p-3 text-right font-medium">{t('date', language)}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                  </tr></thead>
                  <tbody>
                    {filteredTransactions.map(tx => (
                      <tr key={tx.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 text-xs">{formatDateTime(tx.created_at)}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-muted">{txTypeLabel(tx.type)}</span></td>
                        <td className="p-3 text-muted-foreground">{tx.description || '-'}</td>
                        <td className={`p-3 font-medium ${tx.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(tx.amount)}</td>
                        <td className="p-3 font-medium">{formatCurrency(tx.balanceAfter)}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowStatement(false); setStatementSupplier(null); setTransactions([]); }} className="btn-outline text-sm">{t('close', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
