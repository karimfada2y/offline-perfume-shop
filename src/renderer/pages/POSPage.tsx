import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { useAppStore } from '../stores/appStore';
import { t } from '../i18n';
import { formatCurrency } from '../utils/lib';
import { Product, CartItem } from '../../shared/types';
import PrintPreview from '../components/PrintPreview';
import { useDebounceValue } from '../hooks/useDebounceValue';

export default function POSPage() {
  const { language, user } = useAuthStore();
  const { addNotification } = useAppStore();
  const {
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    selectedCustomer, setSelectedCustomer, heldCarts, holdCart, resumeCart,
    discount, setDiscount, paymentMethod, setPaymentMethod, getSubtotal, getTotal
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; nameAr: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [customerList, setCustomerList] = useState<Array<{ id: number; nameAr: string; phone: string }>>([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [printPreviewData, setPrintPreviewData] = useState<Record<string, unknown> | null>(null);
  const [recipePreview, setRecipePreview] = useState<Array<{ productId: number; nameAr: string; totalQuantity: number; unit: string; currentStock: number; sufficient: boolean }> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounceValue(searchQuery, 300);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadProducts = async () => {
    const result = await window.electronAPI.getProducts({ active: true, includeVariants: true }) as Product[];
    setProducts(result.filter(p => p.sellable && p.active));
  };

  const loadCategories = async () => {
    const result = await window.electronAPI.getCategories() as Array<{ id: number; nameAr: string; active: number }>;
    setCategories(result.filter(c => c.active !== 0));
  };

  const loadCustomers = async () => {
    const result = await window.electronAPI.getCustomers() as Array<{ id: number; nameAr: string; phone: string }>;
    setCustomerList(result);
  };

  useEffect(() => {
    if (debouncedSearch.length < 1) {
      loadProducts();
      return;
    }
    const search = async () => {
      const result = await window.electronAPI.searchProducts(debouncedSearch) as Product[];
      setProducts(result.filter(p => p.sellable && p.active));
    };
    search();
  }, [debouncedSearch]);

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;
    const result = await window.electronAPI.searchProducts(barcode.trim()) as Product[];
    const match = result.find(p => p.barcode === barcode.trim() && p.sellable && p.active);
    if (match) {
      handleAddToCart(match);
      setBarcodeInput('');
    } else {
      addNotification(
        language === 'ar' ? `لا يوجد منتج بالباركود: ${barcode}` : `No product found for barcode: ${barcode}`,
        'warning'
      );
      setBarcodeInput('');
    }
  };

  const filteredProducts = useMemo(() => {
    const flat: Product[] = [];
    const source = selectedCategory
      ? products.filter(p => p.categoryId === selectedCategory)
      : products;
    for (const p of source) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (v.sellable && v.active) flat.push(v);
        }
      } else {
        flat.push(p);
      }
    }
    return flat;
  }, [products, selectedCategory]);

  const handleAddToCart = (product: Product) => {
    if (product.currentStock <= 0 && product.inventoryTracked) {
      addNotification(`${product.nameAr} - ${language === 'ar' ? 'نفدت الكمية' : 'Out of stock'}`, 'warning');
      return;
    }
    addToCart({
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      quantity: 1,
      unitPrice: product.retailPrice,
      cost: product.weightedAvgCost,
      discount: 0,
      stock: product.currentStock,
      unit: product.unit,
      size: product.size,
      sizeUnit: product.sizeUnit,
    });
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    const total = getTotal();
    const paid = parseFloat(paidAmount) || 0;

    try {
      const saleResult = await window.electronAPI.createSale({
        userId: user?.id,
        customerId: selectedCustomer?.id,
        date: new Date().toISOString().split('T')[0],
        discount,
        paymentMethod,
        paid: Math.min(paid, total),
        items: cart.map(item => ({
          productId: item.productId,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          cost: item.cost,
          discount: item.discount,
          unit: item.unit || 'piece',
          size: item.size || null,
          sizeUnit: item.sizeUnit || null,
        })),
      }) as { id: number; invoiceNumber: string; total: number; paid: number; remaining: number; discount: number; subtotal: number; items: Array<{ name: string; quantity: number; unitPrice: number; discount: number; total: number }>; change: number; paymentMethod: string };

      setPrintPreviewData({
        invoiceNumber: saleResult.invoiceNumber,
        date: new Date().toLocaleDateString('ar-EG'),
        cashier: user?.displayName || user?.username || '',
        items: saleResult.items.map((item: any, i: number) => ({
          ...item,
          unit: cart[i]?.unit || 'piece',
          size: cart[i]?.size || null,
          sizeUnit: cart[i]?.sizeUnit || null,
        })),
        subtotal: saleResult.subtotal,
        discount: saleResult.discount,
        total: saleResult.total,
        paid: saleResult.paid,
        change: saleResult.change,
        paymentMethod: saleResult.paymentMethod,
      });

      addNotification(language === 'ar' ? 'تم إتمام البيع بنجاح' : 'Sale completed successfully', 'success');
      clearCart();
      setShowPayment(false);
      setPaidAmount('');
      loadProducts();
    } catch (e) {
      addNotification((e as Error).message || 'Error', 'error');
    }
  };

  const openCustomerSearch = async () => {
    await loadCustomers();
    setShowCustomers(true);
  };

  const openPayment = async () => {
    if (cart.length === 0) return;
    try {
      const preview = await window.electronAPI.previewRecipe(
        cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
      ) as Array<{ productId: number; nameAr: string; totalQuantity: number; unit: string; currentStock: number; sufficient: boolean }>;
      setRecipePreview(preview.length > 0 ? preview : null);
    } catch {
      setRecipePreview(null);
    }
    setShowPayment(true);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 animate-fade-in">
      {/* Right side - Products */}
      <div className="flex-1 flex flex-col">
        {/* Barcode Scanner Input */}
        <div className="mb-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(barcodeInput);
                  }
                }}
                placeholder={language === 'ar' ? 'مسح الباركود...' : 'Scan barcode...'}
                className="w-full px-11 py-2.5 rounded-xl border-2 border-primary/60 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-lg shadow-card"
                autoFocus
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg">🔍</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex gap-2">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search', language) + '... (F2)'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all duration-200 shadow-sm"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-xl text-sm whitespace-nowrap transition-all duration-200 font-medium ${
              selectedCategory === null
                ? 'text-white bg-gradient-to-l from-violet-500 to-fuchsia-500 shadow-glow'
                : 'bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('all', language)}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-sm whitespace-nowrap transition-all duration-200 font-medium ${
                selectedCategory === cat.id
                  ? 'text-white bg-gradient-to-l from-violet-500 to-fuchsia-500 shadow-glow'
                  : 'bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.nameAr}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 auto-rows-min">
          {filteredProducts.map((product, i) => (
            <button
              key={product.id}
              onClick={() => handleAddToCart(product)}
              className="group p-3.5 bg-card rounded-2xl border border-border hover:border-primary/60 hover:shadow-card-hover transition-all duration-300 text-right animate-slide-up hover:-translate-y-0.5"
              style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
            >
              <div className="w-full h-1.5 mb-3 rounded-full bg-gradient-to-l from-violet-400/40 to-fuchsia-400/40 group-hover:from-violet-500 group-hover:to-fuchsia-500 transition-all duration-300" />
              <div className="text-sm font-bold truncate">{product.nameAr}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{product.sku}{product.item_code ? ` | ${product.item_code}` : ''}</div>
              <div className="text-lg font-extrabold mt-2 gradient-text">{formatCurrency(product.retailPrice)}</div>
              <div className={`text-xs mt-1 font-medium ${
                product.currentStock <= 0
                  ? 'text-rose-500'
                  : product.currentStock <= (product.minimumStock || 0) && product.minimumStock > 0
                    ? 'text-amber-500'
                    : 'text-emerald-500'
              }`}>
                {language === 'ar' ? 'المخزون' : 'Stock'}: {product.currentStock}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Left side - Cart */}
      <div className="w-96 bg-card rounded-2xl border border-border shadow-card flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-border bg-gradient-to-l from-violet-500/5 to-fuchsia-500/5 rounded-t-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-xs">🛒</span>
              {language === 'ar' ? 'سلة المشتريات' : 'Cart'}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{cart.length} {language === 'ar' ? 'منتج' : 'items'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCustomerSearch}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors font-medium"
            >
              {selectedCustomer ? selectedCustomer.nameAr : t('customer', language)}
            </button>
            <button
              onClick={() => { holdCart(); }}
              className="px-3 py-2 text-xs rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={cart.length === 0}
            >
              {t('holdSale', language)}
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="text-4xl mb-3 opacity-30">🛒</div>
              {language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="p-3 bg-muted/40 border border-border/60 rounded-xl hover:border-primary/30 transition-all duration-200 animate-pop-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold truncate">{item.nameAr}</span>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-red-500 text-sm w-5 h-5 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-input bg-card overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                      className="px-2 py-1 text-sm font-bold hover:bg-muted transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                      className="w-12 px-1 py-1 text-sm bg-transparent text-center focus:outline-none"
                      min="1"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="px-2 py-1 text-sm font-bold hover:bg-muted transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground flex-1 text-left">{formatCurrency(item.unitPrice)}</span>
                </div>
                <div className="text-sm font-extrabold text-right mt-2 gradient-text">
                  {formatCurrency(item.unitPrice * item.quantity - item.discount)}
                </div>
              </div>
            ))
          )}

          {/* Held Carts */}
          {heldCarts.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">{language === 'ar' ? 'معلقات' : 'Held'}</p>
              {heldCarts.map((held, i) => (
                <button
                  key={i}
                  onClick={() => resumeCart(i)}
                  className="w-full p-2.5 mb-1 text-sm rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-right font-medium"
                >
                  {language === 'ar' ? `سلة ${i + 1}` : `Cart ${i + 1}`} - {held.length} {language === 'ar' ? 'منتج' : 'items'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t border-border bg-muted/20 rounded-b-2xl">
          <div className="flex justify-between mb-1.5 text-sm">
            <span className="text-muted-foreground">{t('subtotal', language)}</span>
            <span className="font-bold">{formatCurrency(getSubtotal())}</span>
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder={t('discount', language)}
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex justify-between mb-3 text-xl font-extrabold">
            <span>{t('total', language)}</span>
            <span className="gradient-text">{formatCurrency(getTotal())}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { clearCart(); }}
              className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={cart.length === 0}
            >
              {language === 'ar' ? 'مسح' : 'Clear'}
            </button>
            <button
              onClick={openPayment}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={cart.length === 0}
            >
              {t('completeSale', language)}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('completeSale', language)}</h3>
            <div className="text-center mb-4 p-4 rounded-xl bg-gradient-to-l from-violet-500/10 to-fuchsia-500/10 border border-primary/20">
              <p className="text-muted-foreground">{t('total', language)}</p>
              <p className="text-3xl font-extrabold gradient-text">{formatCurrency(getTotal())}</p>
            </div>
            {recipePreview && recipePreview.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-muted/40 border border-border">
                <p className="text-xs font-medium mb-2 text-muted-foreground">{language === 'ar' ? 'مكونات سيتم خصمها' : 'Components to be consumed'}:</p>
                <div className="space-y-1">
                  {recipePreview.map((comp, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className={comp.sufficient ? '' : 'text-red-600 font-medium'}>{comp.nameAr}</span>
                      <span className={comp.sufficient ? 'text-muted-foreground' : 'text-red-600 font-medium'}>
                        -{comp.totalQuantity.toFixed(2)} {comp.unit}
                        {!comp.sufficient && ` (${language === 'ar' ? 'المتاح' : 'Avail'}: ${comp.currentStock.toFixed(2)})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('paidAmount', language)}</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-card text-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('paymentMethod', language)}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
                >
                  <option value="cash">{t('cash', language)}</option>
                  <option value="visa">{t('visa', language)}</option>
                  <option value="instapay">{t('instapay', language)}</option>
                  <option value="bank_transfer">{t('bankTransfer', language)}</option>
                  <option value="credit">{t('credit', language)}</option>
                </select>
              </div>
              {parseFloat(paidAmount) > 0 && parseFloat(paidAmount) > getTotal() && (
                <div className="p-3 rounded-xl bg-gradient-to-l from-green-500/10 to-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm text-center font-medium border border-green-500/20">
                  {language === 'ar' ? 'المبلغ المتبقي' : 'Change'}: {formatCurrency(parseFloat(paidAmount) - getTotal())}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowPayment(false)}
                className="btn-outline flex-1"
              >
                {t('cancel', language)}
              </button>
              <button
                onClick={handleCompleteSale}
                className="btn-primary flex-1"
              >
                {t('confirm', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal */}
      {showCustomers && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl max-h-96 animate-pop-in">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center text-xs">👤</span>
              {t('customers', language)}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
              <button
                onClick={() => { setSelectedCustomer(null); setShowCustomers(false); }}
                className="w-full p-2.5 rounded-xl text-right hover:bg-muted/60 border border-dashed border-border transition-colors text-sm font-medium"
              >
                {language === 'ar' ? 'بدون عميل' : 'No customer'}
              </button>
              {customerList.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomers(false); }}
                  className="w-full p-2.5 rounded-xl text-right hover:bg-muted/60 hover:border-primary/30 border border-transparent transition-colors"
                >
                  <p className="text-sm font-bold">{c.nameAr}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{c.phone}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCustomers(false)}
              className="btn-outline w-full mt-4"
            >
              {t('close', language)}
            </button>
          </div>
        </div>
      )}

      {printPreviewData && (
        <PrintPreview data={printPreviewData as any} onClose={() => setPrintPreviewData(null)} />
      )}
    </div>
  );
}
