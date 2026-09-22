import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency } from '../utils/lib';
import { Formula, FormulaComponent, ProductionBatch, Product } from '../../shared/types';
import { useDebounceValue } from '../hooks/useDebounceValue';

const BOTTLE_SIZES = [10, 15, 20, 25, 30, 33, 50, 75, 100, 120, 200, 250];

interface PreviewData {
  items: Array<{
    rawMaterialId: number;
    productId: number;
    materialName: string;
    materialSku: string;
    quantityRequired: number;
    currentStock: number;
    unitCost: number;
    totalCost: number;
    sufficient: boolean;
  }>;
  totalCost: number;
  costPerUnit: number;
  batchSize: number;
  scaleFactor: number;
  allSufficient: boolean;
}

export default function ProductionPage() {
  const { language, user } = useAuthStore();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<(Product & { productId?: number })[]>([]);
  const [tab, setTab] = useState<'formulas' | 'batches' | 'raw'>('formulas');
  const [showProduce, setShowProduce] = useState(false);
  const [showFormulaForm, setShowFormulaForm] = useState(false);
  const [editFormula, setEditFormula] = useState<Formula | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddRawMaterial, setShowAddRawMaterial] = useState(false);
  const [newRawMaterialName, setNewRawMaterialName] = useState('');
  const [newRawMaterialNameEn, setNewRawMaterialNameEn] = useState('');
  const [newRawMaterialSku, setNewRawMaterialSku] = useState('');
  const [newRawMaterialUnit, setNewRawMaterialUnit] = useState('ml');
  const [newRawMaterialStock, setNewRawMaterialStock] = useState(0);
  const [newRawMaterialCost, setNewRawMaterialCost] = useState(0);
  const [selectedExistingProduct, setSelectedExistingProduct] = useState(0);
  const debouncedSearch = useDebounceValue(search, 200);

  const [produceForm, setProduceForm] = useState({
    formulaId: 0,
    quantityPlanned: 10,
    bottleProductId: 0,
    bottleSize: 0,
    notes: '',
  });

  const [formulaForm, setFormulaForm] = useState({
    nameAr: '',
    nameEn: '',
    targetProductId: 0,
    batchSize: 100,
    batchUnit: 'ml',
    bottleProductId: 0,
    bottleSize: 0,
    bottleSizeUnit: 'ml',
    targetProductType: 'finished_perfume',
    notes: '',
    components: [] as Array<{
      rawMaterialId: number;
      quantity: number;
      percentage: number;
      componentType: string;
    }>,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [f, b, p, rm] = await Promise.all([
      window.electronAPI.getFormulas() as Promise<Formula[]>,
      window.electronAPI.getProductionBatches() as Promise<ProductionBatch[]>,
      window.electronAPI.getProducts({ active: true }) as Promise<Product[]>,
      window.electronAPI.getRawMaterials() as Promise<Product[]>,
    ]);
    setFormulas(f); setBatches(b); setProducts(p); setRawMaterials(rm);
    setLoading(false);
  };

  const unregisteredRawProducts = useMemo(() =>
    products.filter(p => !rawMaterials.some(rm => rm.productId === p.id)),
  [products, rawMaterials]);

  const handleAddRawMaterial = async () => {
    try {
      if (selectedExistingProduct > 0) {
        await window.electronAPI.createRawMaterial({ productId: selectedExistingProduct, unit: 'ml' });
      } else {
        if (!newRawMaterialName) return;
        const productId = await window.electronAPI.createProduct({
          nameAr: newRawMaterialName,
          nameEn: newRawMaterialNameEn || newRawMaterialName,
          sku: newRawMaterialSku || `RM-${Date.now()}`,
          productType: 'raw_material',
          unit: newRawMaterialUnit,
          currentStock: newRawMaterialStock,
          cost: newRawMaterialCost,
          weightedAvgCost: newRawMaterialCost,
          sellable: false,
          purchasable: true,
          consumable: true,
          producible: false,
          inventoryTracked: true,
          inventoryTrackingMode: 'raw_stock',
          active: true,
        });
        await window.electronAPI.createRawMaterial({ productId, unit: newRawMaterialUnit });
      }
      setShowAddRawMaterial(false);
      setSelectedExistingProduct(0);
      setNewRawMaterialName('');
      setNewRawMaterialNameEn('');
      setNewRawMaterialSku('');
      setNewRawMaterialUnit('ml');
      setNewRawMaterialStock(0);
      setNewRawMaterialCost(0);
      loadData();
    } catch (e) { alert((e as Error).message); }
  };

  const loadPreview = useCallback(async () => {
    if (!produceForm.formulaId || produceForm.quantityPlanned <= 0) { setPreview(null); return; }
    try {
      const result = await window.electronAPI.previewProductionBatch({
        formulaId: produceForm.formulaId,
        quantityPlanned: produceForm.quantityPlanned,
      }) as PreviewData;
      setPreview(result);
    } catch {
      setPreview(null);
    }
  }, [produceForm.formulaId, produceForm.quantityPlanned]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleProduce = async () => {
    if (!produceForm.formulaId || produceForm.quantityPlanned <= 0) return;
    if (preview && !preview.allSufficient) {
      alert(language === 'ar' ? 'المخزون غير كافي لبعض المواد' : 'Insufficient stock for some materials');
      return;
    }
    try {
      await window.electronAPI.createProductionBatch({ ...produceForm, userId: user?.id });
      setShowProduce(false);
      setPreview(null);
      setProduceForm({ formulaId: 0, quantityPlanned: 10, bottleProductId: 0, bottleSize: 0, notes: '' });
      loadData();
      alert(language === 'ar' ? 'تم إنشاء الدفعة بنجاح' : 'Batch created successfully');
    } catch (e) { alert((e as Error).message); }
  };

  const handleSaveFormula = async () => {
    if (!formulaForm.nameAr.trim()) {
      alert(language === 'ar' ? 'أدخل اسم الصيغة' : 'Enter formula name');
      return;
    }
    if (formulaForm.batchSize <= 0) {
      alert(language === 'ar' ? 'حجم الدفعة يجب أن يكون أكبر من صفر' : 'Batch size must be greater than 0');
      return;
    }
    const validComponents = formulaForm.components.filter(c => c.rawMaterialId > 0 && c.quantity > 0);
    if (validComponents.length === 0) {
      alert(language === 'ar' ? 'أضف مكون واحد على الأقل' : 'Add at least one component');
      return;
    }
    try {
      const dataToSend = { ...formulaForm, components: validComponents };
      if (editFormula) {
        await window.electronAPI.updateFormula(editFormula.id, dataToSend);
      } else {
        await window.electronAPI.createFormula(dataToSend);
      }
      setShowFormulaForm(false);
      setEditFormula(null);
      resetFormulaForm();
      loadData();
      alert(language === 'ar' ? 'تم حفظ الصيغة بنجاح' : 'Formula saved successfully');
    } catch (e) { alert((e as Error).message); }
  };

  const handleEditFormula = (f: Formula) => {
    setFormulaForm({
      nameAr: f.nameAr, nameEn: f.nameEn, targetProductId: f.targetProductId || 0,
      batchSize: f.batchSize, batchUnit: f.batchUnit || 'ml',
      bottleProductId: f.bottleProductId || 0, bottleSize: f.bottleSize || 0,
      bottleSizeUnit: f.bottleSizeUnit || 'ml', targetProductType: f.targetProductType || 'finished_perfume',
      notes: f.notes || '',
      components: (f.components || []).map(c => ({
        rawMaterialId: c.rawMaterialId, quantity: c.quantity,
        percentage: c.percentage || 0, componentType: c.componentType || 'raw_material',
      })),
    });
    setEditFormula(f);
    setShowFormulaForm(true);
  };

  const handleDeleteFormula = async (id: number) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف الصيغة؟' : 'Are you sure you want to delete this formula?')) return;
    try {
      await window.electronAPI.deleteFormula(id);
      loadData();
      alert(language === 'ar' ? 'تم حذف الصيغة' : 'Formula deleted');
    } catch (e) { alert((e as Error).message); }
  };

  const resetFormulaForm = () => {
    setFormulaForm({
      nameAr: '', nameEn: '', targetProductId: 0, batchSize: 100, batchUnit: 'ml',
      bottleProductId: 0, bottleSize: 0, bottleSizeUnit: 'ml', targetProductType: 'finished_perfume',
      notes: '', components: [],
    });
  };

  const addComponent = () => {
    setFormulaForm({
      ...formulaForm,
      components: [...formulaForm.components, { rawMaterialId: 0, quantity: 0, percentage: 0, componentType: 'raw_material' }],
    });
  };

  const updateComponent = (index: number, field: string, value: unknown) => {
    const newComponents = [...formulaForm.components];
    (newComponents[index] as Record<string, unknown>)[field] = value;
    setFormulaForm({ ...formulaForm, components: newComponents });
  };

  const removeComponent = (index: number) => {
    setFormulaForm({ ...formulaForm, components: formulaForm.components.filter((_, i) => i !== index) });
  };

  const perfumeProducts = useMemo(() => products.filter(p => ['finished_perfume', 'original_perfume', 'inspired_perfume'].includes(p.productType)), [products]);
  const bottleProducts = useMemo(() => products.filter(p => p.productType === 'bottle'), [products]);
  const filteredFormulas = useMemo(() => formulas.filter(f =>
    f.nameAr.includes(debouncedSearch) || f.nameEn.includes(debouncedSearch)
  ), [formulas, debouncedSearch]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('production', language)}</h1>
        <div className="flex gap-2">
          <button onClick={() => { resetFormulaForm(); setEditFormula(null); setShowFormulaForm(true); }} className="btn-outline text-sm">{t('addFormula', language)}</button>
          <button onClick={() => setShowProduce(true)} className="btn-primary text-sm">{t('produce', language)}</button>
        </div>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search', language) + '...'} className="input-field" />

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab('formulas')} className={`px-4 py-2 text-sm ${tab === 'formulas' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t('formulas', language)}</button>
        <button onClick={() => setTab('batches')} className={`px-4 py-2 text-sm ${tab === 'batches' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t('productionBatches', language)}</button>
        <button onClick={() => setTab('raw')} className={`px-4 py-2 text-sm ${tab === 'raw' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t('rawMaterials', language)}</button>
      </div>

      {tab === 'formulas' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFormulas.map(f => (
            <div key={f.id} className="card-modern p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold">{f.nameAr}</h3>
                  <p className="text-xs text-muted-foreground">{f.batchSize} {f.batchUnit}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditFormula(f)} className="text-primary hover:underline text-xs">{t('edit', language)}</button>
                  <button onClick={() => handleDeleteFormula(f.id)} className="text-red-500 hover:underline text-xs">{t('delete', language)}</button>
                </div>
              </div>
              {f.bottle_product_name && <p className="text-xs mb-1">{t('bottleProduct', language)}: {f.bottle_product_name}</p>}
              {f.bottleSize && <p className="text-xs mb-1">{t('bottleSize', language)}: {f.bottleSize} {f.bottleSizeUnit || 'ml'}</p>}
              {f.components && f.components.length > 0 && (
                <div className="space-y-1 mt-2">
                  {f.components.map(c => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span>{c.material_name}</span>
                      <span>{c.quantity} {f.batchUnit}</span>
                    </div>
                  ))}
                </div>
              )}
              {f.target_product_name && <p className="text-xs text-muted-foreground mt-2">→ {f.target_product_name}</p>}
            </div>
          ))}
          {filteredFormulas.length === 0 && <p className="text-center text-muted-foreground col-span-3 py-8">{t('noFormulas', language)}</p>}
        </div>
      ) : tab === 'batches' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'رقم الدفعة' : 'Batch #'}</th>
              <th className="p-3 text-right font-medium">{t('formula', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="p-3 text-right font-medium">{t('bottleSize', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
              <th className="p-3 text-right font-medium">{t('totalCost', language)}</th>
              <th className="p-3 text-right font-medium">{t('costPerUnit', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{b.batchNumber}</td>
                  <td className="p-3">{b.formula_name}</td>
                  <td className="p-3">{b.product_name || '-'}</td>
                  <td className="p-3">{b.bottle_product_name ? `${b.bottle_product_name} ${b.bottleSize || ''}${b.bottleSizeUnit || 'ml'}` : '-'}</td>
                  <td className="p-3">{b.quantityProduced}</td>
                  <td className="p-3">{formatCurrency(b.totalCost)}</td>
                  <td className="p-3">{formatCurrency(b.costPerUnit)}</td>
                  <td className="p-3 text-xs">{b.created_at?.split('T')[0]}</td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t('noBatches', language)}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddRawMaterial(true)} className="btn-primary text-sm">{t('addRawMaterial', language) || (language === 'ar' ? 'إضافة مادة خام' : 'Add Raw Material')}</button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="p-3 text-right font-medium">{t('sku', language)}</th>
                <th className="p-3 text-right font-medium">{t('itemCode', language)}</th>
                <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
                <th className="p-3 text-right font-medium">{t('currentStock', language)}</th>
                <th className="p-3 text-right font-medium">{t('weightedAvgCost', language)}</th>
              </tr></thead>
              <tbody>
                {rawMaterials.map(rm => (
                  <tr key={rm.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{rm.sku}</td>
                    <td className="p-3 font-mono text-xs">{rm.item_code || '-'}</td>
                    <td className="p-3 font-medium">{rm.nameAr}</td>
                    <td className={`p-3 ${rm.currentStock <= 0 ? 'text-red-600 font-bold' : ''}`}>{rm.currentStock} {rm.unit}</td>
                    <td className="p-3">{formatCurrency(rm.weightedAvgCost)}</td>
                  </tr>
                ))}
                {rawMaterials.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showProduce && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{t('produce', language)}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('formula', language)}</label>
                <select value={produceForm.formulaId} onChange={(e) => setProduceForm({ ...produceForm, formulaId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {formulas.map(f => <option key={f.id} value={f.id}>{f.nameAr} ({f.batchSize} {f.batchUnit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('batchSizePlanned', language)}</label>
                <input type="number" value={produceForm.quantityPlanned} onChange={(e) => setProduceForm({ ...produceForm, quantityPlanned: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('selectBottle', language)}</label>
                <select value={produceForm.bottleProductId} onChange={(e) => {
                  const bottleId = parseInt(e.target.value);
                  const bottle = bottleProducts.find(b => b.id === bottleId);
                  setProduceForm({ ...produceForm, bottleProductId: bottleId, bottleSize: bottle?.size || 0 });
                }} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {bottleProducts.map(b => <option key={b.id} value={b.id}>{b.nameAr} ({b.size || ''} {b.sizeUnit || 'ml'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('bottleSize', language)}</label>
                <select value={produceForm.bottleSize} onChange={(e) => setProduceForm({ ...produceForm, bottleSize: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {produceForm.bottleProductId > 0 ? (
                    (() => {
                      const bottle = bottleProducts.find(b => b.id === produceForm.bottleProductId);
                      const size = bottle?.size;
                      if (size && !BOTTLE_SIZES.includes(size)) {
                        return <option key={size} value={size}>{size} {bottle?.sizeUnit || 'ml'}</option>;
                      }
                      return BOTTLE_SIZES.map(s => <option key={s} value={s}>{s} ml</option>);
                    })()
                  ) : BOTTLE_SIZES.map(s => <option key={s} value={s}>{s} ml</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">{t('notes', language)}</label>
                <input value={produceForm.notes} onChange={(e) => setProduceForm({ ...produceForm, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
            </div>

            {preview && (
              <div className="border border-border rounded-lg p-4 mb-4">
                <h4 className="font-bold mb-2">{t('productionPreview', language)}</h4>
                <div className="space-y-2 mb-3">
                  {preview.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className={item.sufficient ? '' : 'text-red-600 font-bold'}>{item.materialName} ({item.materialSku})</span>
                      <span>
                        {item.quantityRequired.toFixed(2)} {language === 'ar' ? '×' : '×'} {formatCurrency(item.unitCost)} = {formatCurrency(item.totalCost)}
                        {!item.sufficient && <span className="text-red-600 ml-2">⚠ {t('stockInsufficient', language)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between text-sm font-bold">
                    <span>{t('totalCost', language)}</span>
                    <span>{formatCurrency(preview.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('costPerUnit', language)}</span>
                    <span>{formatCurrency(preview.costPerUnit)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowProduce(false); setPreview(null); }} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleProduce} disabled={preview ? !preview.allSufficient : true} className="flex-1 btn-primary disabled:opacity-50 text-sm">{t('confirmProduction', language)}</button>
            </div>
          </div>
        </div>
      )}

      {showFormulaForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editFormula ? t('editFormula', language) : t('addFormula', language)}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('formulaNameAr', language)}</label>
                <input value={formulaForm.nameAr} onChange={(e) => setFormulaForm({ ...formulaForm, nameAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('formulaNameEn', language)}</label>
                <input value={formulaForm.nameEn} onChange={(e) => setFormulaForm({ ...formulaForm, nameEn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('targetProduct', language)}</label>
                <select value={formulaForm.targetProductId} onChange={(e) => setFormulaForm({ ...formulaForm, targetProductId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {perfumeProducts.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('batchSize', language)}</label>
                <input type="number" value={formulaForm.batchSize} onChange={(e) => setFormulaForm({ ...formulaForm, batchSize: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('selectBottle', language)}</label>
                <select value={formulaForm.bottleProductId} onChange={(e) => {
                  const bottleId = parseInt(e.target.value);
                  const bottle = bottleProducts.find(b => b.id === bottleId);
                  setFormulaForm({ ...formulaForm, bottleProductId: bottleId, bottleSize: bottle?.size || 0 });
                }} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {bottleProducts.map(b => <option key={b.id} value={b.id}>{b.nameAr} ({b.size || ''} {b.sizeUnit || 'ml'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('bottleSize', language)}</label>
                <select value={formulaForm.bottleSize} onChange={(e) => setFormulaForm({ ...formulaForm, bottleSize: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {formulaForm.bottleProductId > 0 ? (
                    (() => {
                      const bottle = bottleProducts.find(b => b.id === formulaForm.bottleProductId);
                      const size = bottle?.size;
                      if (size && !BOTTLE_SIZES.includes(size)) {
                        return <option key={size} value={size}>{size} {bottle?.sizeUnit || 'ml'}</option>;
                      }
                      return BOTTLE_SIZES.map(s => <option key={s} value={s}>{s} ml</option>);
                    })()
                  ) : BOTTLE_SIZES.map(s => <option key={s} value={s}>{s} ml</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{t('formulaComponents', language)}</h4>
                <button onClick={addComponent} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs">{t('addComponent', language)}</button>
              </div>
              <div className="space-y-2">
                {formulaForm.components.map((comp, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-muted-foreground mb-1">{t('material', language)}</label>
                      <select value={comp.rawMaterialId} onChange={(e) => updateComponent(idx, 'rawMaterialId', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                        <option value={0}>-</option>
                        {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.nameAr} ({rm.sku})</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-muted-foreground mb-1">{t('quantity', language)}</label>
                      <input type="number" value={comp.quantity} onChange={(e) => updateComponent(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-muted-foreground mb-1">{t('componentType', language)}</label>
                      <select value={comp.componentType} onChange={(e) => updateComponent(idx, 'componentType', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                        <option value="raw_material">{t('rawMaterialType', language)}</option>
                        <option value="oil">{t('oilType', language)}</option>
                        <option value="alcohol">{t('alcoholType', language)}</option>
                        <option value="fixative">{t('fixativeType', language)}</option>
                      </select>
                    </div>
                    <button onClick={() => removeComponent(idx)} className="px-2 py-2 text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowFormulaForm(false); setEditFormula(null); }} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSaveFormula} className="flex-1 btn-primary text-sm">{t('saveFormula', language)}</button>
            </div>
          </div>
        </div>
      )}

      {showAddRawMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{language === 'ar' ? 'إضافة مادة خام' : 'Add Raw Material'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'اختر منتج موجود' : 'Select Existing Product'}</label>
                <select value={selectedExistingProduct} onChange={(e) => setSelectedExistingProduct(parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>{language === 'ar' ? '... أو أنشئ منتج جديد' : '... or create new'}</option>
                  {unregisteredRawProducts.map(p => <option key={p.id} value={p.id}>{p.nameAr} ({p.sku})</option>)}
                </select>
              </div>

              {selectedExistingProduct === 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'اسم المادة بالعربية' : 'Material Name (Arabic)'}</label>
                    <input value={newRawMaterialName} onChange={(e) => setNewRawMaterialName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'اسم المادة بالإنجليزية' : 'Material Name (English)'}</label>
                    <input value={newRawMaterialNameEn} onChange={(e) => setNewRawMaterialNameEn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{t('sku', language)}</label>
                      <input value={newRawMaterialSku} onChange={(e) => setNewRawMaterialSku(e.target.value)} placeholder="RM-001" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الوحدة' : 'Unit'}</label>
                      <select value={newRawMaterialUnit} onChange={(e) => setNewRawMaterialUnit(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                        <option value="ml">ml</option>
                        <option value="gram">gram</option>
                        <option value="kg">kg</option>
                        <option value="liter">liter</option>
                        <option value="piece">piece</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'المخزون الحالي' : 'Current Stock'}</label>
                      <input type="number" value={newRawMaterialStock} onChange={(e) => setNewRawMaterialStock(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'التكلفة' : 'Cost'}</label>
                      <input type="number" value={newRawMaterialCost} onChange={(e) => setNewRawMaterialCost(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowAddRawMaterial(false); setSelectedExistingProduct(0); setNewRawMaterialName(''); setNewRawMaterialNameEn(''); setNewRawMaterialSku(''); }} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleAddRawMaterial} disabled={selectedExistingProduct === 0 && !newRawMaterialName} className="flex-1 btn-primary disabled:opacity-50 text-sm">{language === 'ar' ? 'إضافة' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
