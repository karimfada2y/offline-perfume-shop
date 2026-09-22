import React, { useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import '../../shared/types/electron-api';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'storeInfo' | 'logo' | 'invoice' | 'account' | 'finish';

const STEP_ORDER: Step[] = ['welcome', 'storeInfo', 'logo', 'invoice', 'account', 'finish'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'الترحيب',
  storeInfo: 'بيانات المتجر',
  logo: 'الشعار',
  invoice: 'الفواتير',
  account: 'الحساب',
  finish: 'الانتهاء',
};

export default function SetupWizard({ onComplete }: Props) {
  const { language, setLanguage } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [commercialNumber, setCommercialNumber] = useState('');

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [showLogo, setShowLogo] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showTaxNumber, setShowTaxNumber] = useState(true);
  const [showCommercialNumber, setShowCommercialNumber] = useState(true);
  const [receiptWidth, setReceiptWidth] = useState('80mm');

  const [ownerDisplayName, setOwnerDisplayName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [accountError, setAccountError] = useState('');

  const [receiptName, setReceiptName] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [receiptSubtitle, setReceiptSubtitle] = useState('');
  const [invoiceSubtitle, setInvoiceSubtitle] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  const currentStep = STEP_ORDER[stepIndex];

  const processLogoFile = (file: File) => {
    setLogoError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('هذا الملف غير مدعوم');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('حجم الملف يتجاوز 2 ميجابايت');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) processLogoFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processLogoFile(e.target.files[0]);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await window.electronAPI.updateStoreSettings({
        store_name: storeName,
        owner_name: ownerName,
        phone1,
        phone2,
        address,
        city,
        tax_number: taxNumber,
        commercial_number: commercialNumber,
        show_logo: showLogo ? 1 : 0,
        show_phone: showPhone ? 1 : 0,
        show_address: showAddress ? 1 : 0,
        show_tax_number: showTaxNumber ? 1 : 0,
        show_commercial_number: showCommercialNumber ? 1 : 0,
        receipt_width: receiptWidth,
        receipt_name: receiptName,
        invoice_name: invoiceName,
        receipt_subtitle: receiptSubtitle,
        invoice_subtitle: invoiceSubtitle,
        receipt_footer: receiptFooter,
      });

      if (logoFile) {
        const buffer = await logoFile.arrayBuffer();
        await window.electronAPI.uploadStoreLogo(buffer, logoFile.name);
      }

      await window.electronAPI.createInitialOwner({
        username: ownerUsername,
        password: ownerPassword,
        displayName: ownerDisplayName,
      });

      await window.electronAPI.completeSetup();
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const canNext = (): boolean => {
    if (currentStep === 'account') {
      return ownerDisplayName.trim().length > 0 && ownerUsername.trim().length > 0 && ownerPassword.length >= 6;
    }
    return true;
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-center">محل العطور - الإعداد الأولي</h2>
          <div className="flex justify-center mt-4 gap-2">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-xs text-muted-foreground">{STEP_LABELS[currentStep]}</span>
          </div>
        </div>

        <div className="p-6 min-h-[300px]">
          {currentStep === 'welcome' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-4">&#127800;</div>
              <h3 className="text-lg font-bold">مرحباً بك في نظام محل العطور</h3>
              <p className="text-muted-foreground">سنساعدك في إعداد متجرك خلال دقائق.</p>
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={() => setLanguage('ar')}
                  className={`px-6 py-2 rounded-lg border-2 font-medium transition-all ${
                    language === 'ar' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                  }`}
                >
                  العربية
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-6 py-2 rounded-lg border-2 font-medium transition-all ${
                    language === 'en' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          )}

          {currentStep === 'storeInfo' && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">بيانات المتجر</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">اسم المتجر</label>
                  <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input-field" dir="rtl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">اسم المالك</label>
                  <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="input-field" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رقم الهاتف 1</label>
                  <input value={phone1} onChange={(e) => setPhone1(e.target.value)} className="input-field" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رقم الهاتف 2</label>
                  <input value={phone2} onChange={(e) => setPhone2(e.target.value)} className="input-field" dir="ltr" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">العنوان</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">المدينة</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="input-field" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الرقم الضريبي</label>
                  <input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className="input-field" dir="ltr" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">السجل التجاري</label>
                  <input value={commercialNumber} onChange={(e) => setCommercialNumber(e.target.value)} className="input-field" dir="ltr" />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'logo' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-center">إضافة شعار المتجر</h3>
              <p className="text-sm text-muted-foreground text-center">PNG شفاف، 500×500 بكسل، بحد أقصى 2 ميجابايت</p>

              {logoPreview ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <img src={logoPreview} alt="Logo" className="max-h-40 rounded-lg border border-border" />
                  </div>
                  <div className="flex justify-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="btn-outline text-sm">
                      استبدال
                    </button>
                    <button onClick={() => { setLogoPreview(null); setLogoFile(null); setLogoError(''); }} className="px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 text-sm">
                      إزالة
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={dropRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="text-4xl mb-2">&#128247;</div>
                  <p className="text-muted-foreground">اسحب الشعار هنا</p>
                  <p className="text-muted-foreground text-sm">أو</p>
                  <button className="px-4 py-2 mt-2 rounded-lg bg-primary text-primary-foreground text-sm">اختر صورة</button>
                </div>
              )}

              {logoError && <p className="text-destructive text-sm text-center">{logoError}</p>}

              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {currentStep === 'invoice' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">إعدادات الطباعة والفوترة</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">اسم الإيصال (POS)</label>
                  <input value={receiptName} onChange={(e) => setReceiptName(e.target.value)} placeholder={storeName || 'اسم الإيصال'} className="input-field" dir="rtl" />
                  <p className="text-xs text-muted-foreground mt-1">يظهر في أعلى الإيصال. اتركه فارغاً لاستخدام اسم المتجر.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اسم الفاتورة (A4)</label>
                  <input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} placeholder={storeName || 'اسم الفاتورة'} className="input-field" dir="rtl" />
                  <p className="text-xs text-muted-foreground mt-1">يظهر في فواتير A4 الرسمية. اتركه فارغاً لاستخدام اسم المتجر.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الوصف أسفل الاسم</label>
                  <input value={receiptSubtitle} onChange={(e) => setReceiptSubtitle(e.target.value)} placeholder="لبيع وتركيب العطور" className="input-field" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">نص أسفل الإيصال</label>
                  <input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder="شكراً لزيارتكم" className="input-field" dir="rtl" />
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="w-4 h-4 rounded" />
                  <span>إظهار الشعار</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} className="w-4 h-4 rounded" />
                  <span>إظهار رقم الهاتف</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} className="w-4 h-4 rounded" />
                  <span>إظهار العنوان</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={showTaxNumber} onChange={(e) => setShowTaxNumber(e.target.checked)} className="w-4 h-4 rounded" />
                  <span>إظهار الرقم الضريبي</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={showCommercialNumber} onChange={(e) => setShowCommercialNumber(e.target.checked)} className="w-4 h-4 rounded" />
                  <span>إظهار السجل التجاري</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">عرض الإيصال</label>
                <div className="flex gap-2">
                  {['58mm', '80mm', 'A4'].map((w) => (
                    <button key={w} onClick={() => setReceiptWidth(w)} className={`px-4 py-2 rounded-lg border text-sm transition-all ${receiptWidth === w ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'account' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">إنشاء حساب المالك</h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">الاسم المعروض</label>
                <input value={ownerDisplayName} onChange={(e) => setOwnerDisplayName(e.target.value)} className="input-field" dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">اسم المستخدم</label>
                <input value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value)} className="input-field" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">كلمة المرور</label>
                <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="input-field" dir="ltr" />
                <p className="text-xs text-muted-foreground mt-1">6 أحرف على الأقل</p>
              </div>
              {accountError && <p className="text-destructive text-sm">{accountError}</p>}
            </div>
          )}

          {currentStep === 'finish' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-4">&#10003;</div>
              <h3 className="text-lg font-bold text-green-600">تم إعداد النظام بنجاح</h3>
              <p className="text-muted-foreground">يمكنك تعديل بيانات المتجر لاحقاً من الإعدادات.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-between">
          {stepIndex > 0 && (
            <button onClick={() => setStepIndex(stepIndex - 1)} className="btn-outline transition-colors">
              السابق
            </button>
          )}
          <div className="flex-1"></div>
          {currentStep === 'finish' ? (
            <button onClick={handleComplete} disabled={loading} className="btn-primary transition-opacity disabled:opacity-50">
              {loading ? 'جاري التحميل...' : 'دخول النظام'}
            </button>
          ) : (
            <button onClick={() => setStepIndex(stepIndex + 1)} disabled={!canNext()} className="btn-primary transition-opacity disabled:opacity-50">
              التالي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
