import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency } from '../utils/lib';

export default function ReportsPage() {
  const { language } = useAuthStore();
  const [tab, setTab] = useState<'profit' | 'pl' | 'sales' | 'inventory' | 'production' | 'consumption' | 'profitBySize'>('profit');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [profitData, setProfitData] = useState<Record<string, unknown>>({});
  const [salesData, setSalesData] = useState<Record<string, unknown>>({});
  const [inventoryData, setInventoryData] = useState<Record<string, unknown>>({});
  const [productionData, setProductionData] = useState<Record<string, unknown>>({});
  const [consumptionData, setConsumptionData] = useState<Array<Record<string, unknown>>>([]);
  const [profitBySizeData, setProfitBySizeData] = useState<Array<Record<string, unknown>>>([]);
  const [groupBy, setGroupBy] = useState('product');

  useEffect(() => { loadReport(); }, [tab, dateFrom, dateTo, groupBy]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (tab === 'profit') {
        const data = await window.electronAPI.getProfitReport({ from: dateFrom, to: dateTo, groupBy }) as Record<string, unknown>;
        setProfitData(data);
      } else if (tab === 'pl') {
        const data = await window.electronAPI.getProfitReport({ from: dateFrom, to: dateTo }) as Record<string, unknown>;
        setProfitData(data);
      } else if (tab === 'sales') {
        const data = await window.electronAPI.getSalesReport({ from: dateFrom, to: dateTo }) as Record<string, unknown>;
        setSalesData(data);
      } else if (tab === 'inventory') {
        const data = await window.electronAPI.getInventoryReport() as Record<string, unknown>;
        setInventoryData(data);
      } else if (tab === 'production') {
        const data = await window.electronAPI.getProductionReport({ from: dateFrom, to: dateTo }) as Record<string, unknown>;
        setProductionData(data);
      } else if (tab === 'consumption') {
        const data = await window.electronAPI.getMaterialConsumptionReport({ from: dateFrom, to: dateTo }) as Array<Record<string, unknown>>;
        setConsumptionData(data);
      } else if (tab === 'profitBySize') {
        const data = await window.electronAPI.getProfitBySizeReport({ from: dateFrom, to: dateTo }) as Array<Record<string, unknown>>;
        setProfitBySizeData(data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const tabs = [
    { key: 'profit', label: 'profitReport' },
    { key: 'pl', label: language === 'ar' ? 'قائمة الدخل' : 'P&L Statement' },
    { key: 'sales', label: 'salesReport' },
    { key: 'inventory', label: 'inventoryReport' },
    { key: 'production', label: 'productionReport' },
    { key: 'consumption', label: 'consumptionReport' },
    { key: 'profitBySize', label: 'profitBySize' },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('reports', language)}</h1>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`px-4 py-2 text-sm whitespace-nowrap ${tab === tb.key ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>{t(tb.label, language)}</button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        <span>{language === 'ar' ? 'إلى' : 'to'}</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        {(tab === 'profit') && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="product">{t('profitByProduct', language)}</option>
            <option value="category">{t('profitByCategory', language)}</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : (
        <div className="space-y-4">
          {tab === 'profit' && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('grossSales', language)}</p>
                  <p className="text-xl font-bold">{formatCurrency(profitData.grossSales as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('discount', language)}</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(profitData.discounts as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'المرتجعات' : 'Returns'}</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(profitData.returns as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('netSales', language)}</p>
                  <p className="text-xl font-bold">{formatCurrency(profitData.netSales as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('cogs', language)}</p>
                  <p className="text-xl font-bold">{formatCurrency(profitData.cogs as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('grossProfit', language)}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(profitData.grossProfit as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('operatingExpenses', language)}</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(profitData.expenses as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('netProfit', language)}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(profitData.netProfit as number || 0)}</p>
                </div>
              </div>
              {(profitData.byProduct as Array<Record<string, unknown>>)?.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'المبيعات' : 'Sales'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'الربح' : 'Profit'}</th>
                    </tr></thead>
                    <tbody>
                      {(profitData.byProduct as Array<Record<string, unknown>>).map((item, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3">{item.product_name as string}</td>
                          <td className="p-3">{item.qty as number}</td>
                          <td className="p-3">{formatCurrency(item.sales as number)}</td>
                          <td className="p-3">{formatCurrency(item.cost as number)}</td>
                          <td className="p-3 font-bold text-green-600">{formatCurrency(item.profit as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(profitData.byCategory as Array<Record<string, unknown>>)?.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'القسم' : 'Category'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'المبيعات' : 'Sales'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'الربح' : 'Profit'}</th>
                    </tr></thead>
                    <tbody>
                      {(profitData.byCategory as Array<Record<string, unknown>>).map((item, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3">{item.category as string}</td>
                          <td className="p-3">{formatCurrency(item.sales as number)}</td>
                          <td className="p-3">{formatCurrency(item.cost as number)}</td>
                          <td className="p-3 font-bold text-green-600">{formatCurrency(item.profit as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'pl' && (
            <div className="bg-card rounded-xl border border-border p-6 max-w-xl mx-auto">
              <h2 className="text-xl font-bold mb-6 text-center">{language === 'ar' ? 'قائمة الدخل' : 'Profit & Loss Statement'}</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">{language === 'ar' ? 'من' : 'From'} {dateFrom} {language === 'ar' ? 'إلى' : 'to'} {dateTo}</p>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="font-medium">{language === 'ar' ? 'إجمالي المبيعات' : 'Gross Sales'}</span>
                  <span>{formatCurrency(profitData.grossSales as number || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border pl-4">
                  <span className="text-muted-foreground">- {language === 'ar' ? 'الخصومات' : 'Discounts'}</span>
                  <span className="text-orange-600">({formatCurrency(profitData.discounts as number || 0)})</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border pl-4">
                  <span className="text-muted-foreground">- {language === 'ar' ? 'المرتجعات' : 'Returns'}</span>
                  <span className="text-red-600">({formatCurrency(profitData.returns as number || 0)})</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border font-medium">
                  <span>{t('netSales', language)}</span>
                  <span>{formatCurrency(profitData.netSales as number || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border pl-4">
                  <span className="text-muted-foreground">- {t('cogs', language)}</span>
                  <span className="text-orange-600">({formatCurrency(profitData.cogs as number || 0)})</span>
                </div>
                <div className="flex justify-between py-3 border-b-2 border-border font-bold text-lg">
                  <span>{t('grossProfit', language)}</span>
                  <span className="text-green-600">{formatCurrency(profitData.grossProfit as number || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border text-sm text-muted-foreground">
                  <span>{language === 'ar' ? 'هامش الربح الإجمالي' : 'Gross Margin'}</span>
                  <span>{profitData.netSales ? (((profitData.grossProfit as number) / (profitData.netSales as number)) * 100).toFixed(1) : '0'}%</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border pl-4">
                  <span className="text-muted-foreground">- {t('operatingExpenses', language)}</span>
                  <span className="text-red-600">({formatCurrency(profitData.expenses as number || 0)})</span>
                </div>
                <div className="flex justify-between py-3 font-bold text-xl">
                  <span>{t('netProfit', language)}</span>
                  <span className={(profitData.netProfit as number) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(profitData.netProfit as number || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm text-muted-foreground">
                  <span>{language === 'ar' ? 'هامش صافي الربح' : 'Net Profit Margin'}</span>
                  <span>{profitData.netSales ? (((profitData.netProfit as number) / (profitData.netSales as number)) * 100).toFixed(1) : '0'}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-6 text-center">{language === 'ar' ? '* يستند إلى تكلفة البضاعة المباعة الفعلية من نظام الوصفات' : '* Based on actual COGS from the recipe/BOM system'}</p>
            </div>
          )}

          {tab === 'sales' && (
            <>
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'عدد الطلبات' : 'Orders'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'المبيعات' : 'Sales'}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'الخصومات' : 'Discounts'}</th>
                  </tr></thead>
                  <tbody>
                    {(salesData.salesByDay as Array<Record<string, unknown>> || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3">{item.date as string}</td>
                        <td className="p-3">{item.count as number}</td>
                        <td className="p-3">{formatCurrency(item.total as number)}</td>
                        <td className="p-3">{formatCurrency(item.discounts as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'inventory' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</p>
                  <p className="text-xl font-bold">{formatCurrency(inventoryData.totalValue as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('lowStock', language)}</p>
                  <p className="text-xl font-bold text-orange-600">{inventoryData.lowStockCount as number || 0}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'عدد المنتجات' : 'Product Count'}</p>
                  <p className="text-xl font-bold">{(inventoryData.products as Array<unknown> || []).length}</p>
                </div>
              </div>
              {(inventoryData.byType as Array<Record<string, unknown>>)?.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-right font-medium">{t('productType', language)}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'عدد' : 'Count'}</th>
                      <th className="p-3 text-right font-medium">{language === 'ar' ? 'القيمة' : 'Value'}</th>
                    </tr></thead>
                    <tbody>
                      {(inventoryData.byType as Array<Record<string, unknown>>).map((item, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3">{item.product_type as string}</td>
                          <td className="p-3">{item.count as number}</td>
                          <td className="p-3">{formatCurrency(item.value as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'production' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('totalBatches', language)}</p>
                  <p className="text-xl font-bold">{(productionData.summary as Record<string, unknown>)?.totalBatches as number || 0}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('totalProductionCost', language)}</p>
                  <p className="text-xl font-bold">{formatCurrency((productionData.summary as Record<string, unknown>)?.totalCost as number || 0)}</p>
                </div>
                <div className="card-modern p-4">
                  <p className="text-sm text-muted-foreground">{t('totalProduced', language)}</p>
                  <p className="text-xl font-bold">{(productionData.summary as Record<string, unknown>)?.totalProduced as number || 0}</p>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'رقم الدفعة' : 'Batch #'}</th>
                    <th className="p-3 text-right font-medium">{t('formula', language)}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                    <th className="p-3 text-right font-medium">{t('bottleSize', language)}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                    <th className="p-3 text-right font-medium">{t('totalCost', language)}</th>
                    <th className="p-3 text-right font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  </tr></thead>
                  <tbody>
                    {(productionData.batches as Array<Record<string, unknown>> || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{item.batch_number as string}</td>
                        <td className="p-3">{item.formula_name as string}</td>
                        <td className="p-3">{item.product_name as string || '-'}</td>
                        <td className="p-3">{item.bottle_product_name ? `${item.bottle_product_name} ${item.bottle_size || ''}ml` : '-'}</td>
                        <td className="p-3">{item.quantity_produced as number}</td>
                        <td className="p-3">{formatCurrency(item.total_cost as number)}</td>
                        <td className="p-3 text-xs">{(item.created_at as string)?.split('T')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'consumption' && (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="p-3 text-right font-medium">{t('productNameAr', language)}</th>
                  <th className="p-3 text-right font-medium">{t('sku', language)}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية المستهلكة' : 'Total Used'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'المخزون المتبقي' : 'Remaining Stock'}</th>
                </tr></thead>
                <tbody>
                  {consumptionData.map((item, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3">{item.material_name as string}</td>
                      <td className="p-3 font-mono text-xs">{item.sku as string}</td>
                      <td className="p-3">{item.total_used as number} {item.unit as string}</td>
                      <td className="p-3">{formatCurrency(item.total_cost as number)}</td>
                      <td className={`p-3 ${(item.current_stock as number) <= 0 ? 'text-red-600 font-bold' : ''}`}>{item.current_stock as number} {item.unit as string}</td>
                    </tr>
                  ))}
                  {consumptionData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'profitBySize' && (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'الحجم' : 'Size'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'المبيعات' : 'Sales'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                  <th className="p-3 text-right font-medium">{language === 'ar' ? 'الربح' : 'Profit'}</th>
                </tr></thead>
                <tbody>
                  {profitBySizeData.map((item, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3">{item.product_name as string}</td>
                      <td className="p-3">{item.size as number} {item.size_unit as string}</td>
                      <td className="p-3">{item.qty as number}</td>
                      <td className="p-3">{formatCurrency(item.sales as number)}</td>
                      <td className="p-3">{formatCurrency(item.cost as number)}</td>
                      <td className="p-3 font-bold text-green-600">{formatCurrency(item.profit as number)}</td>
                    </tr>
                  ))}
                  {profitBySizeData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
