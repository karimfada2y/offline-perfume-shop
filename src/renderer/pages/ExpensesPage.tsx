import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency, formatDate } from '../utils/lib';
import { Expense } from '../../shared/types';

export default function ExpensesPage() {
  const { language, user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; nameAr: string; nameEn: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categoryId: 0, amount: 0, date: new Date().toISOString().split('T')[0], description: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [e, c] = await Promise.all([
      window.electronAPI.getExpenses() as Promise<Expense[]>,
      window.electronAPI.getExpenseCategories() as Promise<Array<{ id: number; nameAr: string; nameEn: string }>>,
    ]);
    setExpenses(e); setCategories(c);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.categoryId || form.amount <= 0) return;
    try {
      await window.electronAPI.createExpense({ ...form, userId: user?.id });
      setShowForm(false); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('expenses', language)}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('date', language)}</th>
            <th className="p-3 text-right font-medium">{t('expenseCategory', language)}</th>
            <th className="p-3 text-right font-medium">{t('amount', language)}</th>
            <th className="p-3 text-right font-medium">{t('description', language)}</th>
            <th className="p-3 text-right font-medium">{t('actions', language)}</th>
          </tr></thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3">{formatDate(e.date)}</td>
                <td className="p-3">{e.category_name}</td>
                <td className="p-3 font-medium text-red-600">{formatCurrency(e.amount)}</td>
                <td className="p-3 text-muted-foreground">{e.description || '-'}</td>
                <td className="p-3"><button onClick={async () => { await window.electronAPI.deleteExpense(e.id); loadData(); }} className="text-destructive hover:underline text-sm">{t('delete', language)}</button></td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noExpenses', language)}</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('newExpense', language)}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">{t('expenseCategory', language)}</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium mb-1">{t('amount', language)}</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('date', language)}</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('description', language)}</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} className="flex-1 btn-primary text-sm">{t('save', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
