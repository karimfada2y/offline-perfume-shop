import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { parsePaperWidthMm, saveReceiptPDF } from '../utils/pdf';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  unit?: string;
  size?: number | null;
  sizeUnit?: string | null;
}

interface ReceiptData {
  invoiceNumber: string;
  date: string;
  cashier: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
}

interface StoreSettings {
  store_name: string;
  receipt_name: string;
  receipt_subtitle: string;
  receipt_footer: string;
  logo_path: string;
  phone1: string;
  address: string;
  tax_number: string;
  commercial_number: string;
  receipt_width: string;
  show_logo: number;
  show_phone: number;
  show_address: number;
  show_tax_number: number;
  show_commercial_number: number;
}

interface Printer {
  name: string;
  displayName: string;
  isDefault?: boolean;
}

interface Props {
  data: ReceiptData;
  onClose: () => void;
}

export default function PrintPreview({ data, onClose }: Props) {
  const { language } = useAuthStore();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printDialog, setPrintDialog] = useState(true);

  const [shopName, setShopName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [footer, setFooter] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showTaxNumber, setShowTaxNumber] = useState(true);
  const [showCommercialNumber, setShowCommercialNumber] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<ReceiptItem[]>(data.items);
  const [editDiscount, setEditDiscount] = useState(data.discount);
  const [editPaid, setEditPaid] = useState(data.paid);
  const [editPaymentMethod, setEditPaymentMethod] = useState(data.paymentMethod);
  const [editNotes, setEditNotes] = useState('');
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [s, p] = await Promise.all([
      window.electronAPI.getStoreSettings() as Promise<StoreSettings>,
      window.electronAPI.getPrinters() as Promise<Printer[]>,
    ]);
    setSettings(s);
    setPrinters(p);

    const defaultPrinter = p.find(pr => pr.isDefault)?.name || p[0]?.name || '';
    setSelectedPrinter(defaultPrinter);

    setShopName(s.receipt_name || s.store_name || 'محل العطور');
    setSubtitle(s.receipt_subtitle || '');
    setFooter(s.receipt_footer || '');
    setShowLogo(s.show_logo === 1);
    setShowPhone(s.show_phone === 1);
    setShowAddress(s.show_address === 1);
    setShowTaxNumber(s.show_tax_number === 1);
    setShowCommercialNumber(s.show_commercial_number === 1);
  };

  const subtotal = editItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - editDiscount;
  const change = editPaid > total ? editPaid - total : 0;

  const handlePrint = async () => {
    const receiptData = {
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      cashier: data.cashier,
      items: editItems,
      subtotal,
      discount: editDiscount,
      total,
      paid: editPaid,
      change,
      paymentMethod: editPaymentMethod,
      notes: editNotes,
    };

    await window.electronAPI.printReceipt(receiptData);
    onClose();
  };

  const handleItemEdit = (index: number, field: keyof ReceiptItem, value: string | number) => {
    setEditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
        updated[index].total = (updated[index].quantity * updated[index].unitPrice) - updated[index].discount;
      }
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current || !settings || isDownloadingPDF) return;

    setIsDownloadingPDF(true);
    try {
      const filename = `receipt_${data.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const result = await saveReceiptPDF(previewRef.current, filename, {
        paperWidth: parsePaperWidthMm(settings.receipt_width),
      });
      
      if (result.success) {
        console.log('PDF saved to:', result.filePath);
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert(language === 'ar' ? 'فشل في تحميل PDF' : 'Failed to download PDF');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  if (!settings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>
      </div>
    );
  }

  const logoBase64 = settings.logo_path ? '' : '';

  const paymentMethods: Record<string, string> = { cash: 'نقدي', card: 'بطاقة ائتمان', transfer: 'تحويل بنكي' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-lg">{language === 'ar' ? 'معاينة الإيصال' : 'Receipt Preview'}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(!editMode)} className={`px-3 py-1.5 rounded-lg text-sm border ${editMode ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>
              {editMode ? (language === 'ar' ? 'تم التعديل' : 'Editing') : (language === 'ar' ? 'تعديل' : 'Edit')}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-xl">&times;</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          <div className="w-80 border-l border-border overflow-y-auto p-4 space-y-4 bg-muted/30">
            {editMode && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'اسم المتجر' : 'Shop Name'}</label>
                  <input value={shopName} onChange={(e) => setShopName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}</label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'تذييل الإيصال' : 'Footer'}</label>
                  <textarea value={footer} onChange={(e) => setFooter(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" rows={2} dir="rtl" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" rows={2} dir="rtl" />
                </div>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> {language === 'ar' ? 'الشعار' : 'Logo'}</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> {language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} /> {language === 'ar' ? 'العنوان' : 'Address'}</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showTaxNumber} onChange={(e) => setShowTaxNumber(e.target.checked)} /> {language === 'ar' ? 'الضريبة' : 'Tax'}</label>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'الخصم' : 'Discount'}</label>
                  <input type="number" value={editDiscount} onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'المدفوع' : 'Paid'}</label>
                  <input type="number" value={editPaid} onChange={(e) => setEditPaid(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                    <option value="card">{language === 'ar' ? 'بطاقة ائتمان' : 'Card'}</option>
                    <option value="transfer">{language === 'ar' ? 'تحويل بنكي' : 'Transfer'}</option>
                  </select>
                </div>
              </>
            )}

            {!editMode && (
              <div className="space-y-3">
                <div className="text-sm"><strong>{language === 'ar' ? 'الفاتورة' : 'Invoice'}:</strong> {data.invoiceNumber}</div>
                <div className="text-sm"><strong>{language === 'ar' ? 'التاريخ' : 'Date'}:</strong> {data.date}</div>
                <div className="text-sm"><strong>{language === 'ar' ? 'الكاشير' : 'Cashier'}:</strong> {data.cashier}</div>
                <div className="text-sm"><strong>{language === 'ar' ? 'الإجمالي' : 'Total'}:</strong> {total.toFixed(2)}</div>
                <div className="text-sm"><strong>{language === 'ar' ? 'المدفوع' : 'Paid'}:</strong> {editPaid.toFixed(2)}</div>
                {change > 0 && <div className="text-sm text-green-600"><strong>{language === 'ar' ? 'المتبقي' : 'Change'}:</strong> {change.toFixed(2)}</div>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto flex justify-center p-6 bg-white">
            <div ref={previewRef} style={{ width: settings.receipt_width || '80mm', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: 'rtl' as const, padding: '3mm', background: 'white', color: '#000' }}>

              {showLogo && settings.logo_path && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src={`file://${settings.logo_path}`} style={{ maxWidth: '60%', maxHeight: '50px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>{shopName}</div>
              {subtitle && <div style={{ textAlign: 'center', fontSize: '12px', color: '#555' }}>{subtitle}</div>}
              {showPhone && settings.phone1 && <div style={{ textAlign: 'center', fontSize: '11px', color: '#555' }}>{settings.phone1}</div>}
              {showAddress && settings.address && <div style={{ textAlign: 'center', fontSize: '11px', color: '#555' }}>{settings.address}</div>}
              {showTaxNumber && settings.tax_number && <div style={{ textAlign: 'center', fontSize: '10px', color: '#777' }}>الرقم الضريبي: {settings.tax_number}</div>}
              {showCommercialNumber && settings.commercial_number && <div style={{ textAlign: 'center', fontSize: '10px', color: '#777' }}>السجل التجاري: {settings.commercial_number}</div>}

              <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }}></div>

              <div style={{ fontSize: '11px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم الفاتورة:</span><span>{data.invoiceNumber}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>التاريخ:</span><span>{data.date}</span></div>
                {data.cashier && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>الكاشير:</span><span>{data.cashier}</span></div>}
              </div>

              <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }}></div>

              {editItems.map((item, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px dashed #ddd', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '1px' }}>
                        {item.size ? `${item.size} ${item.sizeUnit || ''}` : ''}{' '}
                        {item.unit && item.unit !== 'piece' ? `(${item.unit === 'g' ? 'جرام' : item.unit === 'kg' ? 'كيلو' : item.unit === 'ml' ? 'مل' : item.unit === 'l' ? 'لتر' : item.unit})` : ''}
                        {' × '}{item.quantity}
                        {item.unitPrice !== item.total / item.quantity && (
                          <span style={{ color: '#888' }}> @ {item.unitPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{item.total.toFixed(2)}</div>
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }}></div>

              <div style={{ fontSize: '12px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المجموع الفرعي:</span><span>{subtotal.toFixed(2)}</span></div>
                {editDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}><span>الخصم:</span><span>-{editDiscount.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}><span>الإجمالي:</span><span>{total.toFixed(2)}</span></div>
              </div>

              <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }}></div>

              <div style={{ fontSize: '12px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>الدفع:</span><span>{paymentMethods[editPaymentMethod] || editPaymentMethod}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المدفوع:</span><span>{editPaid.toFixed(2)}</span></div>
                {change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>المتبقي:</span><span>{change.toFixed(2)}</span></div>}
              </div>

              <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }}></div>

              {footer && <div style={{ marginTop: '10px', fontSize: '11px', color: '#555', whiteSpace: 'pre-line', textAlign: 'center' }}>{footer}</div>}

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#999', textAlign: 'center' }}>شكرا لزيارتكم</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">{language === 'ar' ? 'الطابعة:' : 'Printer:'}</label>
            <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm min-w-[200px]">
              {printers.map(p => (
                <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ' (افتراضي)' : ''}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printDialog} onChange={(e) => setPrintDialog(e.target.checked)} />
              {language === 'ar' ? 'إظهار حوار الطباعة' : 'Show print dialog'}
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloadingPDF}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isDownloadingPDF ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium">
              {language === 'ar' ? 'طباعة' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
