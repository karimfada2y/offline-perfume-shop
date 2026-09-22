import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

interface StoreSettings {
  store_name: string;
  owner_name: string;
  phone1: string;
  phone2: string;
  address: string;
  city: string;
  tax_number: string;
  commercial_number: string;
  logo_path: string;
  currency: string;
  show_logo: number;
  show_phone: number;
  show_address: number;
  show_tax_number: number;
  show_commercial_number: number;
  receipt_width: string;
  invoice_footer: string;
  receipt_name: string;
  invoice_name: string;
  receipt_subtitle: string;
  invoice_subtitle: string;
  receipt_footer: string;
}

const tabs = [
  { key: 'shop', icon: '🏪', labelAr: 'المتجر', labelEn: 'Shop Info' },
  { key: 'receipt', icon: '🧾', labelAr: 'الإيصال', labelEn: 'Receipt' },
  { key: 'invoice', icon: '📄', labelAr: 'الفاتورة', labelEn: 'Invoice' },
  { key: 'appearance', icon: '🎨', labelAr: 'المظهر', labelEn: 'Appearance' },
  { key: 'backup', icon: '💾', labelAr: 'النسخ الاحتياطي', labelEn: 'Backup' },
];

export default function SettingsPage() {
  const { language, setLanguage } = useAuthStore();
  const [activeTab, setActiveTab] = useState('shop');
  const [shopNameAr, setShopNameAr] = useState('');
  const [shopNameEn, setShopNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressAr, setAddressAr] = useState('');
  const [addressEn, setAddressEn] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [email, setEmail] = useState('');
  const [commercialRegistration, setCommercialRegistration] = useState('');
  const [footerAr, setFooterAr] = useState('');
  const [footerEn, setFooterEn] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [invoiceLogoPath, setInvoiceLogoPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [backupList, setBackupList] = useState<Array<{ name: string; path: string; size: number; createdAt: string }>>([]);

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: '', owner_name: '', phone1: '', phone2: '',
    address: '', city: '', tax_number: '', commercial_number: '',
    logo_path: '', currency: 'EGP',
    show_logo: 1, show_phone: 1, show_address: 1,
    show_tax_number: 1, show_commercial_number: 1,
    receipt_width: '80mm', invoice_footer: '',
    receipt_name: '', invoice_name: '',
    receipt_subtitle: '', invoice_subtitle: '', receipt_footer: '',
  });
  const [storeLogoPreview, setStoreLogoPreview] = useState('');

  useEffect(() => { loadSettings(); loadBackups(); loadStoreSettings(); }, []);

  const loadSettings = async () => {
    const settings = await window.electronAPI.getSettings() as { business: Record<string, string> };
    if (settings.business) {
      setShopNameAr(settings.business.name_ar || '');
      setShopNameEn(settings.business.name_en || '');
      setPhone(settings.business.phone || '');
      setAddress(settings.business.address || '');
      setAddressAr(settings.business.address_ar || '');
      setAddressEn(settings.business.address_en || '');
      setWhatsapp(settings.business.whatsapp || '');
      setTaxNumber(settings.business.tax_number || '');
      setEmail(settings.business.email || '');
      setCommercialRegistration(settings.business.commercial_registration || '');
      setFooterAr(settings.business.footer_ar || '');
      setFooterEn(settings.business.footer_en || '');
      setLogoPath(settings.business.logo_path || '');
      setInvoiceLogoPath(settings.business.invoice_logo_path || '');
    }
    setLoading(false);
  };

  const loadStoreSettings = async () => {
    const s = await window.electronAPI.getStoreSettings() as StoreSettings;
    setStoreSettings(s);
    if (s.logo_path) setStoreLogoPreview(s.logo_path);
  };

  const loadBackups = async () => {
    const backups = await window.electronAPI.listBackups() as Array<{ name: string; path: string; size: number; createdAt: string }>;
    setBackupList(backups);
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSave = async () => {
    await window.electronAPI.updateSettings({
      business: {
        nameAr: shopNameAr, nameEn: shopNameEn, phone, address, addressAr, addressEn,
        whatsapp, taxNumber, email, commercialRegistration, footerAr, footerEn,
        logoPath, invoiceLogoPath,
      },
    });
    await window.electronAPI.updateStoreSettings(storeSettings as unknown as Record<string, unknown>);
    showSaved();
  };

  const handleUploadLogo = async (type: 'main' | 'invoice') => {
    const result = await window.electronAPI.uploadLogo(type) as string | null;
    if (result) {
      if (type === 'main') setLogoPath(result);
      else setInvoiceLogoPath(result);
    }
  };

  const handleUploadStoreLogo = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const result = await window.electronAPI.uploadStoreLogo(buffer, file.name) as { success: boolean; path?: string };
      if (result.success && result.path) {
        setStoreLogoPreview(result.path);
        setStoreSettings(prev => ({ ...prev, logo_path: result.path! }));
        setLogoPath(result.path);
      }
    };
    input.click();
  };

  const handleRemoveStoreLogo = async () => {
    await window.electronAPI.removeStoreLogo();
    setStoreLogoPreview('');
    setStoreSettings(prev => ({ ...prev, logo_path: '' }));
    setLogoPath('');
  };

  const updateStoreField = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setStoreSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleBackup = async () => {
    await window.electronAPI.createBackup();
    loadBackups();
  };

  const handleRestore = async (path: string) => {
    if (confirm(t('restoreConfirm', language))) {
      await window.electronAPI.restoreBackup(path);
      alert(language === 'ar' ? 'تمت الاستعادة' : 'Restored');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('settings', language)}</h1>
        {saved && (
          <span className="text-sm text-green-600 font-medium animate-pulse">
            {language === 'ar' ? '✓ تم الحفظ' : '✓ Saved'}
          </span>
        )}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Shop Info Tab */}
      {activeTab === 'shop' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-bold mb-4">{t('shopSettings', language)}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{t('shopNameAr', language)}</label><input value={shopNameAr} onChange={(e) => setShopNameAr(e.target.value)} className={inputClass} dir="rtl" /></div>
            <div><label className={labelClass}>{t('shopNameEn', language)}</label><input value={shopNameEn} onChange={(e) => setShopNameEn(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>{t('phone', language)}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} dir="ltr" /></div>
            <div><label className={labelClass}>{t('email', language)}</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} dir="ltr" /></div>
            <div><label className={labelClass}>{t('whatsapp', language)}</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} dir="ltr" /></div>
            <div><label className={labelClass}>{t('taxNumber', language)}</label><input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className={inputClass} dir="ltr" /></div>
            <div><label className={labelClass}>{t('commercialRegistration', language)}</label><input value={commercialRegistration} onChange={(e) => setCommercialRegistration(e.target.value)} className={inputClass} dir="ltr" /></div>
            <div><label className={labelClass}>{t('addressAr', language)}</label><input value={addressAr} onChange={(e) => setAddressAr(e.target.value)} className={inputClass} dir="rtl" /></div>
            <div><label className={labelClass}>{t('addressEn', language)}</label><input value={addressEn} onChange={(e) => setAddressEn(e.target.value)} className={inputClass} /></div>
            <div className="col-span-2"><label className={labelClass}>{t('address', language)}</label><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
          </div>
          <button onClick={handleSave} className="btn-primary text-sm mt-4">{t('save', language)}</button>
        </div>
      )}

      {/* Receipt Tab */}
      {activeTab === 'receipt' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-bold mb-4">{language === 'ar' ? 'إعدادات الإيصال' : 'Receipt Settings'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{language === 'ar' ? 'اسم المتجر على الإيصال' : 'Receipt Shop Name'}</label><input value={storeSettings.receipt_name} onChange={(e) => updateStoreField('receipt_name', e.target.value)} placeholder={storeSettings.store_name} className={inputClass} dir="rtl" /></div>
            <div><label className={labelClass}>{language === 'ar' ? 'نص تحت العنوان' : 'Subtitle'}</label><input value={storeSettings.receipt_subtitle} onChange={(e) => updateStoreField('receipt_subtitle', e.target.value)} className={inputClass} dir="rtl" /></div>
            <div className="col-span-2"><label className={labelClass}>{language === 'ar' ? 'تذييل الإيصال' : 'Footer'}</label><input value={storeSettings.receipt_footer} onChange={(e) => updateStoreField('receipt_footer', e.target.value)} className={inputClass} dir="rtl" /></div>
            <div>
              <label className={labelClass}>{language === 'ar' ? 'عرض الإيصال' : 'Width'}</label>
              <select value={storeSettings.receipt_width} onChange={(e) => updateStoreField('receipt_width', e.target.value)} className={inputClass}>
                <option value="58mm">58mm</option>
                <option value="72mm">72mm</option>
                <option value="80mm">80mm</option>
                <option value="A4">A4</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{language === 'ar' ? 'العملة' : 'Currency'}</label>
              <select value={storeSettings.currency} onChange={(e) => updateStoreField('currency', e.target.value)} className={inputClass}>
                <option value="EGP">ج.م - EGP</option>
                <option value="USD">$ - USD</option>
                <option value="SAR">ر.س - SAR</option>
                <option value="AED">د.إ - AED</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 mt-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings.show_logo === 1} onChange={(e) => updateStoreField('show_logo', e.target.checked ? 1 : 0)} /> {language === 'ar' ? 'إظهار الشعار' : 'Show Logo'}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings.show_phone === 1} onChange={(e) => updateStoreField('show_phone', e.target.checked ? 1 : 0)} /> {language === 'ar' ? 'إظهار الهاتف' : 'Show Phone'}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings.show_address === 1} onChange={(e) => updateStoreField('show_address', e.target.checked ? 1 : 0)} /> {language === 'ar' ? 'إظهار العنوان' : 'Show Address'}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings.show_tax_number === 1} onChange={(e) => updateStoreField('show_tax_number', e.target.checked ? 1 : 0)} /> {language === 'ar' ? 'إظهار الرقم الضريبي' : 'Show Tax'}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings.show_commercial_number === 1} onChange={(e) => updateStoreField('show_commercial_number', e.target.checked ? 1 : 0)} /> {language === 'ar' ? 'السجل التجاري' : 'Show Com. Reg.'}</label>
          </div>
          <button onClick={handleSave} className="btn-primary text-sm mt-4">{t('save', language)}</button>
        </div>
      )}

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-bold mb-4">{language === 'ar' ? 'إعدادات الفاتورة' : 'Invoice Settings'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{language === 'ar' ? 'اسم المتجر على الفاتورة' : 'Invoice Shop Name'}</label><input value={storeSettings.invoice_name} onChange={(e) => updateStoreField('invoice_name', e.target.value)} placeholder={storeSettings.store_name} className={inputClass} dir="rtl" /></div>
            <div><label className={labelClass}>{language === 'ar' ? 'نص تحت العنوان' : 'Subtitle'}</label><input value={storeSettings.invoice_subtitle} onChange={(e) => updateStoreField('invoice_subtitle', e.target.value)} className={inputClass} dir="rtl" /></div>
            <div className="col-span-2"><label className={labelClass}>{language === 'ar' ? 'تذييل الفاتورة' : 'Footer'}</label><input value={storeSettings.invoice_footer} onChange={(e) => updateStoreField('invoice_footer', e.target.value)} className={inputClass} dir="rtl" /></div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>{language === 'ar' ? 'شعار الفاتورة' : 'Invoice Logo'}</label>
            <div className="flex items-center gap-3">
              {invoiceLogoPath && <div className="w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted"><img src={`file://${invoiceLogoPath}`} alt="Invoice Logo" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>}
              <button onClick={() => handleUploadLogo('invoice')} className="btn-outline text-sm">{language === 'ar' ? 'رفع شعار' : 'Upload Logo'}</button>
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary text-sm mt-4">{t('save', language)}</button>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-bold mb-4">{language === 'ar' ? 'شعار المتجر الرئيسي' : 'Store Logo'}</h3>
            <p className="text-sm text-muted-foreground mb-3">{language === 'ar' ? 'يظهر على الإيصالات والواجهة' : 'Appears on receipts and the interface'}</p>
            <div className="flex items-center gap-4">
              {storeLogoPreview && <div className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-muted"><img src={`file://${storeLogoPreview}`} alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>}
              <div className="flex flex-col gap-2">
                <button onClick={handleUploadStoreLogo} className="btn-outline text-sm">{language === 'ar' ? 'رفع شعار' : 'Upload Logo'}</button>
                {storeLogoPreview && <button onClick={handleRemoveStoreLogo} className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm">{language === 'ar' ? 'إزالة الشعار' : 'Remove Logo'}</button>}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-bold mb-4">{language === 'ar' ? 'اللغة' : 'Language'}</h3>
            <div className="flex gap-2">
              <button onClick={() => setLanguage('ar')} className={`px-6 py-2.5 rounded-lg text-sm font-medium ${language === 'ar' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>{t('arabic', language)}</button>
              <button onClick={() => setLanguage('en')} className={`px-6 py-2.5 rounded-lg text-sm font-medium ${language === 'en' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>{t('english', language)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t('backups', language)}</h3>
            <button onClick={handleBackup} className="btn-primary text-sm">{t('createBackup', language)}</button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {backupList.map(b => (
              <div key={b.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted text-sm">
                <div><p className="font-medium">{b.name}</p><p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString('ar-EG')}</p></div>
                <button onClick={() => handleRestore(b.path)} className="text-primary hover:underline text-xs">{t('restore', language)}</button>
              </div>
            ))}
            {backupList.length === 0 && <p className="text-center text-muted-foreground py-4">{t('noData', language)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
