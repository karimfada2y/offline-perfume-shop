import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency, formatDate } from '../utils/lib';
import { PurchaseInvoice, Supplier, Product } from '../../shared/types';

export default function PurchasesPage() {
  const { language, user } = useAuthStore();
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierId: 0, date: new Date().toISOString().split('T')[0], discount: 0, paid: 0, paymentMethod: 'cash', notes: '',
    items: [] as Array<{ productId: number; productName: string; quantity: number; unitCost: number; discount: number }>,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, s, pr] = await Promise.all([
      window.electronAPI.getPurchases() as Promise<PurchaseInvoice[]>,
      window.electronAPI.getSuppliers() as Promise<Supplier[]>,
      window.electronAPI.getProducts({ active: true }) as Promise<Product[]>,
    ]);
    setPurchases(p); setSuppliers(s); setProducts(pr);
    setLoading(false);
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { productId: 0, productName: '', quantity: 1, unitCost: 0, discount: 0 }] });
  };

  const updateItem = (index: number, field: string, value: unknown) => {
    const items = [...form.items];
    (items[index] as Record<string, unknown>)[field] = value;
    if (field === 'productId') {
      const product = products.find(p => p.id === (value as number));
      if (product) { items[index].productName = product.nameAr; items[index].unitCost = product.cost; }
    }
    setForm({ ...form, items });
  };

  const removeItem = (index: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const total = form.items.reduce((sum, item) => sum + item.quantity * item.unitCost - item.discount, 0) - form.discount;

  const handleSave = async () => {
    if (!form.supplierId) { alert(language === 'ar' ? 'اختر المورد' : 'Select supplier'); return; }
    if (form.items.length === 0) { alert(language === 'ar' ? 'أضف منتجات' : 'Add products'); return; }
    try {
      await window.electronAPI.createPurchase({ ...form, userId: user?.id });
      setShowForm(false); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('purchases', language)}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('invoiceNumber', language)}</th>
            <th className="p-3 text-right font-medium">{t('date', language)}</th>
            <th className="p-3 text-right font-medium">{t('supplier', language)}</th>
            <th className="p-3 text-right font-medium">{t('total', language)}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
          </tr></thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{p.invoiceNumber}</td>
                <td className="p-3">{formatDate(p.date)}</td>
                <td className="p-3">{p.supplier_name}</td>
                <td className="p-3 font-medium">{formatCurrency(p.total)}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'غير مدفوع' : 'Unpaid')}</span></td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noPurchases', language)}</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{t('newPurchase', language)}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-medium mb-1">{t('supplier', language)}</label>
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium mb-1">{t('date', language)}</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
            </div>

            <div className="space-y-2 mb-4">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <select value={item.productId} onChange={(e) => updateItem(i, 'productId', parseInt(e.target.value))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value={0}>{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
                  </select>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-2 rounded-lg border border-input bg-background text-sm" placeholder={t('quantity', language)} />
                  <input type="number" value={item.unitCost} onChange={(e) => updateItem(i, 'unitCost', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-2 rounded-lg border border-input bg-background text-sm" placeholder={t('price', language)} />
                  <button onClick={() => removeItem(i)} className="px-2 py-2 text-destructive text-sm">✕</button>
                </div>
              ))}
              <button onClick={addItem} className="text-primary text-sm hover:underline">+ {t('add', language)}</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-medium mb-1">{t('discount', language)}</label><input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('paidAmount', language)}</label><input type="number" value={form.paid} onChange={(e) => setForm({ ...form, paid: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
            </div>

            <div className="text-left text-lg font-bold mb-4">{t('total', language)}: {formatCurrency(total)}</div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} className="flex-1 btn-primary text-sm">{t('completePurchase', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
