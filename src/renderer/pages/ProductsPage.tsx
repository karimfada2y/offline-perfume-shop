import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency } from '../utils/lib';
import { Product, Category, Brand } from '../../shared/types';
import { useDebounceValue } from '../hooks/useDebounceValue';

const formTabs = [
  { key: 'basic', icon: '📋', labelAr: 'البيانات الأساسية', labelEn: 'Basic Info' },
  { key: 'pricing', icon: '💰', labelAr: 'الأسعار', labelEn: 'Pricing' },
  { key: 'inventory', icon: '📦', labelAr: 'المخزون', labelEn: 'Inventory' },
];

export default function ProductsPage() {
  const { language } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [formTab, setFormTab] = useState('basic');
  const debouncedSearch = useDebounceValue(search, 200);
  const [form, setForm] = useState<Record<string, unknown>>({
    nameAr: '', nameEn: '', sku: '', barcode: '', itemCode: '', itemCode2: '', categoryId: null, brandId: null,
    unit: 'piece', size: '', sizeUnit: 'ml', description: '',
    retailPrice: 0, wholesalePrice: 0, minimumPrice: 0, cost: 0, minimumStock: 0, currentStock: 0,
    productType: 'finished_perfume', sellable: true, purchasable: true, consumable: false, producible: true, inventoryTracked: true, inventoryTrackingMode: 'finished_stock', parentProductId: null, active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, c, b] = await Promise.all([
      window.electronAPI.getProducts() as Promise<Product[]>,
      window.electronAPI.getCategories() as Promise<Category[]>,
      window.electronAPI.getBrands() as Promise<Brand[]>,
    ]);
    setProducts(p);
    setCategories(c.filter(c => c.active !== false));
    setBrands(b.filter(b => b.active !== false));
    setLoading(false);
  };

  const filtered = useMemo(() => products.filter(p =>
    p.nameAr.includes(debouncedSearch) || (p.nameEn && p.nameEn.includes(debouncedSearch)) || p.sku.includes(debouncedSearch) || (p.barcode && p.barcode.includes(debouncedSearch))
  ), [products, debouncedSearch]);

  const toggleExpand = (id: number) => {
    const next = new Set(expandedProducts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProducts(next);
  };

  const handleSave = async () => {
    try {
      if (editProduct) {
        await window.electronAPI.updateProduct(editProduct.id, form);
      } else {
        await window.electronAPI.createProduct(form);
      }
      setShowForm(false);
      setEditProduct(null);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleEdit = (p: Product) => {
    setForm({
      nameAr: p.nameAr, nameEn: p.nameEn || '', sku: p.sku, barcode: p.barcode || '',
      itemCode: p.itemCode || p.item_code || '', itemCode2: p.itemCode2 || p.item_code_2 || '',
      categoryId: p.categoryId, brandId: p.brandId, unit: p.unit,
      size: p.size || '', sizeUnit: p.sizeUnit || 'ml', description: p.description || '',
      retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, minimumPrice: p.minimumPrice,
      cost: p.cost, minimumStock: p.minimumStock, currentStock: p.currentStock,
      productType: p.productType, sellable: p.sellable, purchasable: p.purchasable,
      consumable: p.consumable, producible: p.producible,
      inventoryTracked: p.inventoryTracked, inventoryTrackingMode: p.inventoryTrackingMode || 'finished_stock',
      parentProductId: p.parentProductId || null,
      active: p.active,
    });
    setEditProduct(p);
    setFormTab('basic');
    setShowForm(true);
  };

  const handleAddVariant = (parentId: number) => {
    const parent = products.find(p => p.id === parentId);
    setForm({
      nameAr: parent?.nameAr || '', nameEn: parent?.nameEn || '', sku: '', barcode: '', itemCode: '', itemCode2: '',
      categoryId: parent?.categoryId || null, brandId: parent?.brandId || null, unit: parent?.unit || 'piece',
      size: '', sizeUnit: parent?.sizeUnit || 'ml', description: '',
      retailPrice: 0, wholesalePrice: 0, minimumPrice: 0, cost: 0, minimumStock: 0, currentStock: 0,
      productType: parent?.productType || 'finished_perfume', sellable: true, purchasable: true,
      consumable: parent?.consumable || false, producible: parent?.producible || true,
      inventoryTracked: true, inventoryTrackingMode: parent?.inventoryTrackingMode || 'finished_stock',
      parentProductId: parentId, active: true,
    });
    setEditProduct(null);
    setFormTab('basic');
    setShowForm(true);
  };

  const defaultForm = { nameAr: '', nameEn: '', sku: '', barcode: '', itemCode: '', itemCode2: '', categoryId: null, brandId: null, unit: 'piece', size: '', sizeUnit: 'ml', description: '', retailPrice: 0, wholesalePrice: 0, minimumPrice: 0, cost: 0, minimumStock: 0, currentStock: 0, productType: 'finished_perfume', sellable: true, purchasable: true, consumable: false, producible: true, inventoryTracked: true, inventoryTrackingMode: 'finished_stock', parentProductId: null, active: true };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          <span className="gradient-text">{t('products', language)}</span>
        </h1>
        <button
          onClick={() => { setForm(defaultForm); setEditProduct(null); setFormTab('basic'); setShowForm(true); }}
          className="btn-primary"
        >
          {t('add', language)}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search', language) + '...'}
        className="input-field"
      />

      <div className="card-modern overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium w-8"></th>
              <th className="p-3 text-right font-medium">{t('sku', language)}</th>
              <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
              <th className="p-3 text-right font-medium">{t('size', language)}</th>
              <th className="p-3 text-right font-medium">{t('category', language)}</th>
              <th className="p-3 text-right font-medium">{t('costPrice', language)}</th>
              <th className="p-3 text-right font-medium">{t('retailPrice', language)}</th>
              <th className="p-3 text-right font-medium">{t('currentStock', language)}</th>
              <th className="p-3 text-right font-medium">{t('actions', language)}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const hasVariants = p.variants && p.variants.length > 0;
              const isExpanded = expandedProducts.has(p.id);
              return (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      {hasVariants ? (
                        <button onClick={() => toggleExpand(p.id)} className="text-muted-foreground hover:text-foreground text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : null}
                    </td>
                    <td className="p-3 font-mono text-xs">{p.sku}</td>
                    <td className="p-3 font-medium">
                      {p.nameAr}
                      {hasVariants && <span className="ml-2 text-xs text-muted-foreground">({p.variants!.length})</span>}
                    </td>
                    <td className="p-3">{p.size ? `${p.size} ${p.sizeUnit || ''}` : '-'}</td>
                    <td className="p-3 text-muted-foreground">{categories.find(c => c.id === p.categoryId)?.nameAr || '-'}</td>
                    <td className="p-3">{formatCurrency(p.cost)}</td>
                    <td className="p-3 font-medium">{formatCurrency(p.retailPrice)}</td>
                    <td className={`p-3 ${p.currentStock <= p.minimumStock && p.minimumStock > 0 ? 'text-red-600 font-bold' : ''}`}>
                      {p.currentStock}
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleEdit(p)} className="text-primary hover:underline text-sm ml-2">
                        {t('edit', language)}
                      </button>
                      <button onClick={() => handleAddVariant(p.id)} className="text-primary hover:underline text-sm ml-2">
                        + {t('addVariant', language)}
                      </button>
                    </td>
                  </tr>
                  {hasVariants && isExpanded && p.variants!.map(v => (
                    <tr key={v.id} className="border-b border-border bg-muted/10 hover:bg-muted/20 transition-colors">
                      <td className="p-3"></td>
                      <td className="p-3 font-mono text-xs pl-8">{v.sku}</td>
                      <td className="p-3 font-medium pl-8">{v.nameAr}</td>
                      <td className="p-3">{v.size ? `${v.size} ${v.sizeUnit || ''}` : '-'}</td>
                      <td className="p-3 text-muted-foreground">{categories.find(c => c.id === v.categoryId)?.nameAr || '-'}</td>
                      <td className="p-3">{formatCurrency(v.cost)}</td>
                      <td className="p-3 font-medium">{formatCurrency(v.retailPrice)}</td>
                      <td className={`p-3 ${v.currentStock <= v.minimumStock && v.minimumStock > 0 ? 'text-red-600 font-bold' : ''}`}>
                        {v.currentStock}
                      </td>
                      <td className="p-3">
                        <button onClick={() => handleEdit(v)} className="text-primary hover:underline text-sm">
                          {t('edit', language)}
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{t('noProducts', language)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editProduct ? t('edit', language) : t('add', language)} {t('products', language)}
              {!!form.parentProductId && <span className="text-sm font-normal text-muted-foreground ml-2">({t('variant', language)})</span>}
            </h3>

            {/* Form Tabs */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg mb-4">
              {formTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFormTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    formTab === tab.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
                </button>
              ))}
            </div>

            {/* Basic Info Tab */}
            {formTab === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t('productNameAr', language)}</label>
                  <input value={form.nameAr as string} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={inputClass} dir="rtl" />
                </div>
                <div>
                  <label className={labelClass}>{t('productNameEn', language)}</label>
                  <input value={form.nameEn as string} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('barcode', language)}</label>
                  <input value={form.barcode as string} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('itemCode', language)}</label>
                  <input value={form.itemCode as string} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('itemCode2', language)}</label>
                  <input value={form.itemCode2 as string} onChange={(e) => setForm({ ...form, itemCode2: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('category', language)}</label>
                  <select value={form.categoryId as number || ''} onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) || null })} className={inputClass}>
                    <option value="">-</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('brand', language)}</label>
                  <select value={form.brandId as number || ''} onChange={(e) => setForm({ ...form, brandId: parseInt(e.target.value) || null })} className={inputClass}>
                    <option value="">-</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('productType', language)}</label>
                  <select value={form.productType as string} onChange={(e) => setForm({ ...form, productType: e.target.value })} className={inputClass}>
                    <option value="finished_perfume">{t('finishedPerfume', language)}</option>
                    <option value="original_perfume">{t('originalPerfume', language)}</option>
                    <option value="inspired_perfume">{t('inspiredPerfume', language)}</option>
                    <option value="fragrance_oil">{t('fragranceOil', language)}</option>
                    <option value="raw_material">{t('rawMaterial', language)}</option>
                    <option value="bottle">{t('bottle', language)}</option>
                    <option value="cap">{t('cap', language)}</option>
                    <option value="sprayer">{t('sprayer', language)}</option>
                    <option value="box">{t('box', language)}</option>
                    <option value="packaging">{t('packaging', language)}</option>
                    <option value="accessory">{t('accessory', language)}</option>
                    <option value="other">{t('other', language)}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('size', language)}</label>
                  <div className="flex gap-2">
                    <input type="number" value={form.size as string} onChange={(e) => setForm({ ...form, size: e.target.value })} className={`flex-1 ${inputClass}`} />
                    <select value={form.sizeUnit as string} onChange={(e) => setForm({ ...form, sizeUnit: e.target.value })} className={`w-20 ${inputClass}`}>
                      <option value="ml">ml</option>
                      <option value="l">L</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t('unit', language)}</label>
                  <select value={form.unit as string} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                    <option value="piece">{t('piece', language)}</option>
                    <option value="ml">{t('ml', language)}</option>
                    <option value="l">{t('liter', language)}</option>
                    <option value="g">{t('gram', language)}</option>
                    <option value="kg">{t('kg', language)}</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t('description', language)}</label>
                  <input value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
                </div>
                <div className="col-span-2 flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellable as boolean} onChange={(e) => setForm({ ...form, sellable: e.target.checked })} /> {language === 'ar' ? 'قابل للبيع' : 'Sellable'}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.purchasable as boolean} onChange={(e) => setForm({ ...form, purchasable: e.target.checked })} /> {language === 'ar' ? 'قابل للشراء' : 'Purchasable'}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.consumable as boolean} onChange={(e) => setForm({ ...form, consumable: e.target.checked })} /> {language === 'ar' ? 'مواد خام' : 'Consumable'}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.producible as boolean} onChange={(e) => setForm({ ...form, producible: e.target.checked })} /> {language === 'ar' ? 'قابل للإنتاج' : 'Producible'}</label>
                </div>
              </div>
            )}

            {/* Pricing Tab */}
            {formTab === 'pricing' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t('costPrice', language)}</label>
                  <input type="number" value={form.cost as number} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('retailPrice', language)}</label>
                  <input type="number" value={form.retailPrice as number} onChange={(e) => setForm({ ...form, retailPrice: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('wholesalePrice', language)}</label>
                  <input type="number" value={form.wholesalePrice as number} onChange={(e) => setForm({ ...form, wholesalePrice: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('minimumPrice', language)}</label>
                  <input type="number" value={form.minimumPrice as number} onChange={(e) => setForm({ ...form, minimumPrice: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {formTab === 'inventory' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t('currentStock', language)}</label>
                    <input type="number" value={form.currentStock as number} onChange={(e) => setForm({ ...form, currentStock: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('minimumStock', language)}</label>
                    <input type="number" value={form.minimumStock as number} onChange={(e) => setForm({ ...form, minimumStock: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.inventoryTracked as boolean} onChange={(e) => setForm({ ...form, inventoryTracked: e.target.checked })} /> {language === 'ar' ? 'تتبع المخزون' : 'Track Stock'}</label>
                </div>
                {(form.sellable as boolean) && (form.inventoryTracked as boolean) && (
                  <div>
                    <label className={labelClass}>{language === 'ar' ? 'وضع تتبع المخزون' : 'Inventory Tracking Mode'}</label>
                    <select value={form.inventoryTrackingMode as string || 'finished_stock'} onChange={(e) => setForm({ ...form, inventoryTrackingMode: e.target.value })} className={inputClass}>
                      <option value="finished_stock">{language === 'ar' ? 'مخزون المنتج النهائي' : 'Finished Product Stock'}</option>
                      <option value="recipe_consumption">{language === 'ar' ? 'استهلاك حسب الوصفة' : 'Recipe / Component Consumption'}</option>
                    </select>
                    {form.inventoryTrackingMode === 'recipe_consumption' && (
                      <p className="text-xs text-muted-foreground mt-1">{language === 'ar' ? 'سيتم خصم المكونات من المخزون مباشرة عند البيع بدلاً من خصم المنتج النهائي' : 'Components will be deducted from inventory at time of sale instead of the finished product'}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowForm(false); setEditProduct(null); }} className="btn-outline transition-colors text-sm">
                {t('cancel', language)}
              </button>
              <button onClick={handleSave} className="flex-1 btn-primary transition-opacity text-sm">
                {t('save', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
