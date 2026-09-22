import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency } from '../utils/lib';
import { Product, InventoryMovement } from '../../shared/types';
import { useDebounceValue } from '../hooks/useDebounceValue';

const PRODUCT_TYPE_FILTERS = [
  { value: '', labelAr: 'الكل', labelEn: 'All' },
  { value: 'finished_perfume', labelAr: 'عطر جاهز', labelEn: 'Finished Perfume' },
  { value: 'fragrance_oil', labelAr: 'زيت عطري', labelEn: 'Fragrance Oil' },
  { value: 'bottle', labelAr: 'زجاجة', labelEn: 'Bottle' },
  { value: 'raw_material', labelAr: 'مادة خام', labelEn: 'Raw Material' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

export default function InventoryPage() {
  const { language, user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: 0, quantity: 0, direction: 'increase' as 'increase' | 'decrease', reason: 'counting_correction' });
  const debouncedSearch = useDebounceValue(search, 200);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [p, m] = await Promise.all([
      window.electronAPI.getInventory() as Promise<Product[]>,
      window.electronAPI.getInventoryMovements() as Promise<InventoryMovement[]>,
    ]);
    setProducts(p); setMovements(m);
  };

  const filtered = useMemo(() => products.filter(p => {
    const matchesSearch = p.nameAr.includes(debouncedSearch) || p.nameEn.includes(debouncedSearch) || p.sku.includes(debouncedSearch) || (p.item_code && p.item_code.includes(debouncedSearch)) || (p.item_code_2 && p.item_code_2.includes(debouncedSearch));
    const matchesType = !typeFilter || p.productType === typeFilter;
    return matchesSearch && matchesType;
  }), [products, debouncedSearch, typeFilter]);

  const { totalValue, lowStockCount, outOfStockCount } = useMemo(() => {
    let totalValue = 0, lowStockCount = 0, outOfStockCount = 0;
    for (const p of filtered) {
      totalValue += p.currentStock * p.weightedAvgCost;
      if (p.currentStock <= p.minimumStock && p.minimumStock > 0) lowStockCount++;
      if (p.currentStock <= 0) outOfStockCount++;
    }
    return { totalValue, lowStockCount, outOfStockCount };
  }, [filtered]);

  const handleAdjust = async () => {
    if (!adjustForm.productId || adjustForm.quantity <= 0) return;
    try {
      await window.electronAPI.adjustInventory({ ...adjustForm, userId: user?.id });
      setShowAdjust(false); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('inventory', language)}</h1>
        <button onClick={() => setShowAdjust(true)} className="btn-primary text-sm">{t('adjustStock', language)}</button>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm ${tab === 'stock' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t('stock', language)}</button>
        <button onClick={() => setTab('movements')} className={`px-4 py-2 text-sm ${tab === 'movements' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t('stockMovements', language)}</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card-modern p-4">
          <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </div>
        <div className="card-modern p-4">
          <p className="text-sm text-muted-foreground">{language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card-modern p-4">
          <p className="text-sm text-muted-foreground">{t('lowStock', language)}</p>
          <p className="text-2xl font-bold text-orange-600">{lowStockCount}</p>
        </div>
        <div className="card-modern p-4">
          <p className="text-sm text-muted-foreground">{language === 'ar' ? 'نفد المخزون' : 'Out of Stock'}</p>
          <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search', language) + '...'} className="input-field flex-1" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          {PRODUCT_TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{language === 'ar' ? f.labelAr : f.labelEn}</option>)}
        </select>
      </div>

      {tab === 'stock' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium">{t('sku', language)}</th>
              <th className="p-3 text-right font-medium">{t('itemCode', language)}</th>
              <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
              <th className="p-3 text-right font-medium">{t('productType', language)}</th>
              <th className="p-3 text-right font-medium">{t('currentStock', language)}</th>
              <th className="p-3 text-right font-medium">{t('minimumStock', language)}</th>
              <th className="p-3 text-right font-medium">{t('weightedAvgCost', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3 font-mono text-xs">{p.item_code || '-'}</td>
                  <td className="p-3 font-medium">{p.nameAr}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-muted">{p.productType}</span></td>
                  <td className={`p-3 font-medium ${p.currentStock <= p.minimumStock && p.minimumStock > 0 ? 'text-red-600' : ''}`}>{p.currentStock}</td>
                  <td className="p-3 text-muted-foreground">{p.minimumStock}</td>
                  <td className="p-3">{formatCurrency(p.weightedAvgCost)}</td>
                  <td className="p-3">{formatCurrency(p.currentStock * p.weightedAvgCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium">{t('date', language)}</th>
              <th className="p-3 text-right font-medium">{t('sku', language)}</th>
              <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'النوع' : 'Type'}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'قبل' : 'Before'}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'بعد' : 'After'}</th>
              <th className="p-3 text-right font-medium">{t('cost', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'السبب' : 'Reason'}</th>
            </tr></thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 text-xs">{m.created_at?.split('T')[0]}</td>
                  <td className="p-3 font-mono text-xs">{m.sku || '-'}</td>
                  <td className="p-3">{m.product_name}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-muted">{m.type}</span></td>
                  <td className={`p-3 font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                  <td className="p-3">{m.beforeQuantity}</td>
                  <td className="p-3">{m.afterQuantity}</td>
                  <td className="p-3">{m.unitCost > 0 ? formatCurrency(m.unitCost * Math.abs(m.quantity)) : '-'}</td>
                  <td className="p-3 text-muted-foreground">{m.reason || m.referenceType || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdjust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('adjustStock', language)}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">{t('products', language)}</label>
                <select value={adjustForm.productId} onChange={(e) => setAdjustForm({ ...adjustForm, productId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>{products.map(p => <option key={p.id} value={p.id}>{p.nameAr} ({p.sku})</option>)}
                </select></div>
              <div><label className="block text-sm font-medium mb-1">{t('quantity', language)}</label>
                <input type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الاتجاه' : 'Direction'}</label>
                <select value={adjustForm.direction} onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value as 'increase' | 'decrease' })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="increase">{language === 'ar' ? 'زيادة' : 'Increase'}</option>
                  <option value="decrease">{language === 'ar' ? 'نقص' : 'Decrease'}</option>
                </select></div>
              <div><label className="block text-sm font-medium mb-1">{t('adjustmentReason', language)}</label>
                <select value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="counting_correction">{t('countingCorrection', language)}</option>
                  <option value="damaged">{t('damaged', language)}</option>
                  <option value="lost">{t('lost', language)}</option>
                  <option value="found">{t('found', language)}</option>
                  <option value="other">{t('other', language)}</option>
                </select></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAdjust(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleAdjust} className="flex-1 btn-primary text-sm">{t('confirm', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
