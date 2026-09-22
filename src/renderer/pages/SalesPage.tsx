import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { formatCurrency, formatDate, formatDateTime } from '../utils/lib';
import { Sale } from '../../shared/types';
import PrintPreview from '../components/PrintPreview';

export default function SalesPage() {
  const { language } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printPreviewData, setPrintPreviewData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (dateFrom) filters.from = dateFrom;
    if (dateTo) filters.to = dateTo;
    setSales(await window.electronAPI.getSales(filters) as Sale[]);
    setLoading(false);
  };

  const viewSale = async (id: number) => {
    const sale = await window.electronAPI.getSaleById(id) as Sale;
    setSelectedSale(sale);
  };

  const handlePrintSale = (sale: Sale) => {
    setPrintPreviewData({
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      cashier: sale.user_name || '',
      items: (sale.items || []).map((item: any) => ({
        name: item.productName || item.product_name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.unit_price || 0,
        discount: item.discount || 0,
        total: item.total,
        unit: item.productUnit || item.product_unit || 'piece',
        size: item.productSize || item.product_size || null,
        sizeUnit: item.productSizeUnit || item.product_size_unit || null,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      paid: sale.paid,
      change: sale.paid > sale.total ? sale.paid - sale.total : 0,
      paymentMethod: sale.paymentMethod || 'cash',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('sales', language)}</h1>
      </div>

      <div className="flex gap-4">
        <div><label className="block text-sm font-medium mb-1">{t('dateFrom', language)}</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
        <div><label className="block text-sm font-medium mb-1">{t('dateTo', language)}</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
        <div className="flex items-end"><button onClick={loadData} className="btn-primary text-sm">{t('filter', language)}</button></div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('invoiceNumber', language)}</th>
            <th className="p-3 text-right font-medium">{t('date', language)}</th>
            <th className="p-3 text-right font-medium">{t('customer', language)}</th>
            <th className="p-3 text-right font-medium">{t('total', language)}</th>
            <th className="p-3 text-right font-medium">{t('paid', language)}</th>
            <th className="p-3 text-right font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
            <th className="p-3 text-right font-medium">{t('actions', language)}</th>
          </tr></thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{s.invoiceNumber}</td>
                <td className="p-3">{formatDate(s.date)}</td>
                <td className="p-3">{s.customer_name || '-'}</td>
                <td className="p-3 font-medium">{formatCurrency(s.total)}</td>
                <td className="p-3">{formatCurrency(s.paid)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${s.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : s.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {s.paymentStatus === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : s.paymentStatus === 'partial' ? (language === 'ar' ? 'جزئي' : 'Partial') : (language === 'ar' ? 'غير مدفوع' : 'Unpaid')}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => viewSale(s.id)} className="text-primary hover:underline text-sm">{language === 'ar' ? 'عرض' : 'View'}</button>
                    <button onClick={() => handlePrintSale(s)} className="text-primary hover:underline text-sm">{t('print', language)}</button>
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t('noSales', language)}</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-pop-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{selectedSale.invoiceNumber}</h3>
              <div className="flex gap-2">
                <button onClick={() => selectedSale && handlePrintSale(selectedSale)} className="btn-outline text-xs">{t('print', language)} {language === 'ar' ? 'إيصال' : 'Receipt'}</button>
                <button onClick={() => window.electronAPI.printInvoice(selectedSale)} className="btn-outline text-xs">{t('print', language)} {language === 'ar' ? 'فاتورة' : 'Invoice'}</button>
                <button onClick={() => setSelectedSale(null)} className="text-muted-foreground hover:text-foreground">{t('close', language)}</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-muted-foreground">{t('date', language)}:</span> {formatDateTime(selectedSale.created_at || '')}</div>
              <div><span className="text-muted-foreground">{t('cashier', language)}:</span> {selectedSale.user_name}</div>
              <div><span className="text-muted-foreground">{t('customer', language)}:</span> {selectedSale.customer_name || '-'}</div>
              <div><span className="text-muted-foreground">{t('paymentMethod', language)}:</span> {selectedSale.paymentMethod}</div>
            </div>
            {selectedSale.items && (
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="p-2 text-right">{t('products', language)}</th>
                  <th className="p-2 text-right">{t('quantity', language)}</th>
                  <th className="p-2 text-right">{t('price', language)}</th>
                  <th className="p-2 text-right">{t('total', language)}</th>
                </tr></thead>
                <tbody>
                  {selectedSale.items.map(item => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2">{item.quantity}</td>
                      <td className="p-2">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-2">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="text-left space-y-1">
              <p className="text-sm">{t('subtotal', language)}: {formatCurrency(selectedSale.subtotal)}</p>
              <p className="text-sm">{t('discount', language)}: {formatCurrency(selectedSale.discount)}</p>
              <p className="text-lg font-bold">{t('total', language)}: {formatCurrency(selectedSale.total)}</p>
              <p className="text-sm">{t('paid', language)}: {formatCurrency(selectedSale.paid)}</p>
              {selectedSale.remaining > 0 && <p className="text-sm text-red-600">{t('remaining', language)}: {formatCurrency(selectedSale.remaining)}</p>}
            </div>
          </div>
        </div>
      )}

      {printPreviewData && (
        <PrintPreview data={printPreviewData as any} onClose={() => setPrintPreviewData(null)} />
      )}
    </div>
  );
}
