import React, { useState, useEffect } from 'react';
import '../../shared/types/electron-api';

interface StoreSettings {
  store_name: string;
  receipt_name: string;
  invoice_name: string;
  receipt_subtitle: string;
  invoice_subtitle: string;
  receipt_footer: string;
  logo_path: string;
  show_logo: number;
  show_phone: number;
  show_address: number;
  show_tax_number: number;
  show_commercial_number: number;
  phone1: string;
  address: string;
  city: string;
  tax_number: string;
  commercial_number: string;
}

interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  onPrint: (config: PrintConfig) => void;
  type: 'receipt' | 'invoice';
  data: {
    invoiceNumber?: string;
    items?: Array<{ name: string; quantity: number; price: number; discount?: number }>;
    total?: number;
    payment?: number;
    customerName?: string;
    date?: string;
  };
}

export interface PrintConfig {
  businessName: string;
  subtitle: string;
  footer: string;
  showLogo: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showTaxNumber: boolean;
  showCommercialNumber: boolean;
}

export default function PrintDialog({ open, onClose, onPrint, type, data }: PrintDialogProps) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [selectedName, setSelectedName] = useState<'store' | 'receipt' | 'invoice' | 'custom'>('store');
  const [customName, setCustomName] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      window.electronAPI.getStoreSettings().then((s) => {
        setSettings(s);
        setShowLogo(s.show_logo === 1);
        setLoading(false);
      });
    }
  }, [open]);

  if (!open || !settings) return null;

  const getDisplayName = (): string => {
    if (selectedName === 'custom' && customName) return customName;
    if (selectedName === 'receipt' && settings.receipt_name) return settings.receipt_name;
    if (selectedName === 'invoice' && settings.invoice_name) return settings.invoice_name;
    return settings.store_name || 'محل العطور';
  };

  const getSubtitle = (): string => {
    if (selectedName === 'receipt') return settings.receipt_subtitle || '';
    if (selectedName === 'invoice') return settings.invoice_subtitle || '';
    return settings.receipt_subtitle || settings.invoice_subtitle || '';
  };

  const getFooter = (): string => {
    return settings.receipt_footer || '';
  };

  const handlePrint = () => {
    onPrint({
      businessName: getDisplayName(),
      subtitle: getSubtitle(),
      footer: getFooter(),
      showLogo,
      showPhone: settings.show_phone === 1,
      showAddress: settings.show_address === 1,
      showTaxNumber: settings.show_tax_number === 1,
      showCommercialNumber: settings.show_commercial_number === 1,
    });
  };

  const nameOptions = [
    { value: 'store', label: 'اسم المتجر', sub: settings.store_name },
    { value: 'receipt', label: 'اسم الإيصال', sub: settings.receipt_name || '(غير محدد)' },
    { value: 'invoice', label: 'اسم الفاتورة', sub: settings.invoice_name || '(غير محدد)' },
    { value: 'custom', label: 'اسم مخصص', sub: null },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-bold">اختر اسم المنشأة للطباعة</h3>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            {nameOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="printName"
                  checked={selectedName === opt.value}
                  onChange={() => setSelectedName(opt.value)}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium">{opt.label}</span>
                  {opt.sub && <span className="text-muted-foreground text-sm mr-2">({opt.sub})</span>}
                </div>
              </label>
            ))}
          </div>

          {selectedName === 'custom' && (
            <div>
              <label className="block text-sm font-medium mb-1">الاسم المخصص</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="أدخل الاسم"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                dir="rtl"
              />
            </div>
          )}

          <div className="border-t border-border pt-3">
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
              <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="w-4 h-4 rounded" />
              <span>إظهار الشعار</span>
            </label>
          </div>

          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-medium mb-2">معاينة</h4>
            <div className="bg-background border border-border rounded-lg p-4 text-center space-y-2" style={{ maxWidth: type === 'receipt' ? '300px' : '100%', margin: '0 auto' }}>
              {showLogo && settings.logo_path && (
                <div className="text-xs text-muted-foreground">[الشعار]</div>
              )}
              <div className="font-bold text-lg">{getDisplayName()}</div>
              {getSubtitle() && <div className="text-sm text-muted-foreground">{getSubtitle()}</div>}
              {settings.show_address === 1 && settings.address && (
                <div className="text-xs text-muted-foreground">{settings.address}{settings.city ? `، ${settings.city}` : ''}</div>
              )}
              {settings.show_phone === 1 && settings.phone1 && (
                <div className="text-xs text-muted-foreground">{settings.phone1}</div>
              )}
              {settings.show_tax_number === 1 && settings.tax_number && (
                <div className="text-xs text-muted-foreground">الرقم الضريبي: {settings.tax_number}</div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="text-sm">{type === 'receipt' ? 'إيصال مبيعات' : 'فاتورة مبيعات'}</div>
                {data.invoiceNumber && <div className="text-xs text-muted-foreground">رقم: {data.invoiceNumber}</div>}
              </div>
              {data.items && data.items.length > 0 && (
                <div className="text-xs text-left space-y-1 border-t border-border pt-2">
                  {data.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{item.name} × {item.quantity}</span>
                      <span>{((item.price * item.quantity) - (item.discount || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                  {data.items.length > 3 && <div className="text-muted-foreground">... و {data.items.length - 3} منتجات أخرى</div>}
                </div>
              )}
              {data.total !== undefined && (
                <div className="border-t border-border pt-2 mt-2 font-bold">
                  الإجمالي: {data.total.toFixed(2)}
                </div>
              )}
              {getFooter() && (
                <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{getFooter()}</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-between">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
            إلغاء
          </button>
          <button onClick={handlePrint} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
            طباعة
          </button>
        </div>
      </div>
    </div>
  );
}
