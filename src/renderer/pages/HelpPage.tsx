import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

interface Step {
  title: string;
  desc: string;
}

interface GuideSection {
  key: string;
  icon: string;
  titleAr: string;
  titleEn: string;
  introAr: string;
  introEn: string;
  stepsAr: Step[];
  stepsEn: Step[];
  tipAr?: string;
  tipEn?: string;
}

const sections: GuideSection[] = [
  {
    key: 'setup',
    icon: '🚀',
    titleAr: 'الإعداد الأولي',
    titleEn: 'First-Time Setup',
    introAr: 'نفّذ هذه الخطوات مرة واحدة عند بداية استخدام النظام.',
    introEn: 'Do these steps once when you start using the system.',
    stepsAr: [
      { title: 'بيانات المتجر', desc: 'افتح الإعدادات ← معلومات النشاط واكتب اسم متجرك وعنوانك وهاتفك.' },
      { title: 'الإيصال والفاتورة', desc: 'من تبويب الإيصال، اضبط اسم المتجر وشعارك وبيانات التواصل التي تظهر في الطباعة.' },
      { title: 'فتح الصندوق', desc: 'افتح صفحة الصندوق واضغط «فتح جلسة» وادخل رصيدك الافتتاحي النقدي.' },
      { title: 'نسخة احتياطية', desc: 'من الإعدادات ← النسخ الاحتياطي، أنشئ أول نسخة احتياطية واحفظها في مكان آمن.' },
    ],
    stepsEn: [
      { title: 'Shop info', desc: 'Go to Settings → Business info and enter your shop name, address and phone.' },
      { title: 'Receipt & invoice', desc: 'In the Receipt tab, set the shop name, logo and contact details shown when printing.' },
      { title: 'Open cash register', desc: 'Open the Cash page, click "Open session" and enter your opening cash amount.' },
      { title: 'Backup', desc: 'In Settings → Backup, create your first backup and keep it somewhere safe.' },
    ],
    tipAr: 'يمكنك تغيير هذه البيانات في أي وقت لاحقاً من الإعدادات.',
    tipEn: 'You can change all of this later from Settings.',
  },
  {
    key: 'products',
    icon: '🧴',
    titleAr: 'إضافة المنتجات',
    titleEn: 'Adding Products',
    introAr: 'المنتجات هي قلب النظام — أضفها أولاً لتتمكن من البيع.',
    introEn: 'Products are the core — add them first so you can sell.',
    stepsAr: [
      { title: 'الأقسام', desc: 'افتح «الأقسام» واضغط إضافة، وأنشئ مثلاً: عطور رجالية، عطور نسائية، معجون، بخور.' },
      { title: 'منتج جديد', desc: 'افتح «المنتجات» واضغط إضافة، ثم املأ: الاسم بالعربي، الرقم (SKU)، القسم.' },
      { title: 'الأسعار', desc: 'في تبويب الأسعار اكتب سعر التكلفة وسعر البيع — الفرق بينهما هو ربحك.' },
      { title: 'المخزون', desc: 'في تبويب المخزون اكتب الكمية الموجودة والحد الأدنى (تنبيه عند الوصول له).' },
      { title: 'الباركود (اختياري)', desc: 'امسح أو اكتب الباركود ليُستخدم ماسح الباركود في نقطة البيع.' },
      { title: 'الأحجام المتعددة', desc: 'لعطر بحجمين (٣٠مل و ٥٠مل): احفظ المنتج ثم اضغط «إضافة حجم» بجانبه.' },
    ],
    stepsEn: [
      { title: 'Categories', desc: 'Open "Categories" → Add, e.g. Men, Women, Incense, Oud.' },
      { title: 'New product', desc: 'Open "Products" → Add, fill Arabic name, SKU and category.' },
      { title: 'Pricing', desc: 'In the Pricing tab enter cost price and retail price — the difference is your profit.' },
      { title: 'Inventory', desc: 'In the Inventory tab enter current quantity and the minimum stock alert level.' },
      { title: 'Barcode (optional)', desc: 'Scan or type a barcode so the POS barcode scanner can find it.' },
      { title: 'Multiple sizes', desc: 'For a perfume in 30ml and 50ml: save the product, then click "Add size" next to it.' },
    ],
    tipAr: 'النوع الصحيح للمنتج مهم: «زيت عطري» للمواد، «زجاجة» للعبوات، «عطر جاهز» للعطور النهائية.',
    tipEn: 'Pick the right product type: "Fragrance oil" for materials, "Bottle" for packaging, "Finished perfume" for final products.',
  },
  {
    key: 'pos',
    icon: '🛒',
    titleAr: 'بيع سريع (نقطة البيع)',
    titleEn: 'Quick Sale (POS)',
    introAr: 'هذه أهم شاشة في النظام — بها تبيع للعملاء يومياً.',
    introEn: 'The most important screen — this is where you sell daily.',
    stepsAr: [
      { title: 'افتح نقطة البيع', desc: 'من القائمة الجانبية اضغط 🛒 نقطة البيع.' },
      { title: 'ابحث عن المنتج', desc: 'امسح الباركود أو اكتب اسم المنتج في خانة البحث (أو اضغط F2 للتركيز على البحث).' },
      { title: 'أضف للسلة', desc: 'اضغط على بطاقة المنتج ليُضاف إلى السلة على اليسار تلقائياً.' },
      { title: 'عدّل الكمية', desc: 'في السلة استخدم + و − لتعديل الكمية، أو احذف المنتج بزر ✕.' },
      { title: 'العميل والخصم', desc: 'اختر اسم العميل (اختياري) وأدخل خصماً إن وجد.' },
      { title: 'إتمام البيع', desc: 'اضغط «إتمام البيع» ← اكتب المبلغ المدفوع ← اختر طريقة الدفع ← تأكيد.' },
      { title: 'طباعة الإيصال', desc: 'سيظهر إيصال للطباعة مباشرة، أو اطبعه لاحقاً من صفحة المبيعات.' },
    ],
    stepsEn: [
      { title: 'Open POS', desc: 'Click 🛒 POS in the sidebar.' },
      { title: 'Find the product', desc: 'Scan the barcode or type the product name in search (or press F2).' },
      { title: 'Add to cart', desc: 'Click the product card — it is added to the cart on the left automatically.' },
      { title: 'Adjust quantity', desc: 'In the cart use + and − to change quantity, or ✕ to remove.' },
      { title: 'Customer & discount', desc: 'Pick the customer name (optional) and enter a discount if any.' },
      { title: 'Complete sale', desc: 'Click "Complete Sale" → enter paid amount → choose payment method → confirm.' },
      { title: 'Print receipt', desc: 'A receipt appears for printing, or print later from the Sales page.' },
    ],
    tipAr: 'زر «إيقاف مؤقت» يحفظ السلة الحالية لتستأنفها لاحقاً (مفيد عند مقاطعةك من عميل).',
    tipEn: '"Hold" saves the current cart to resume later (useful when a customer interrupts you).',
  },
  {
    key: 'purchases',
    icon: '📦',
    titleAr: 'تسجيل المشتريات',
    titleEn: 'Recording Purchases',
    introAr: 'سجّل كل ما تشتريه من موردين ليتحدث المخزون والحسابات تلقائياً.',
    introEn: 'Record everything you buy from suppliers — stock and accounts update automatically.',
    stepsAr: [
      { title: 'أضف المورد', desc: 'افتح «الموردين» واضغط إضافة، واكتب اسم المورد وهاتفه.' },
      { title: 'فاتورة شراء', desc: 'افتح «فواتير الشراء» واضغط إضافة، واختر المورد.' },
      { title: 'أضف المنتجات', desc: 'اختر المنتجات والكميات والأسعار التي اشتريتها.' },
      { title: 'الدفع', desc: 'حدد كم دفعت الآن (نقدي) وكم المتبقي آجل.' },
      { title: 'احفظ', desc: 'بعد الحفظ يزداد مخزون المنتجات تلقائياً، ويُسجَّل المتبقي كدين على المورد.' },
    ],
    stepsEn: [
      { title: 'Add supplier', desc: 'Open "Suppliers" → Add, enter name and phone.' },
      { title: 'Purchase invoice', desc: 'Open "Purchases" → Add, select the supplier.' },
      { title: 'Add products', desc: 'Pick products, quantities and prices you bought.' },
      { title: 'Payment', desc: 'Set how much you paid now (cash) and how much is remaining on credit.' },
      { title: 'Save', desc: 'Stock increases automatically; the remaining amount becomes supplier debt.' },
    ],
    tipAr: 'سجل كل فاتورة شراء — بدونها المخزون لن يتحدث وحساب المورد لن يصح.',
    tipEn: 'Record every purchase invoice — without it stock and supplier balance will be wrong.',
  },
  {
    key: 'production',
    icon: '⚗️',
    titleAr: 'صناعة العطر (الإنتاج)',
    titleEn: 'Making Perfume (Production)',
    introAr: 'حوّل المواد الخام إلى عطر جاهز للبيع، مع خصم المواد وحساب التكلفة تلقائياً.',
    introEn: 'Turn raw materials into a sellable perfume — materials deduct and cost calculates automatically.',
    stepsAr: [
      { title: 'المواد الخام', desc: 'سجّل زيوتك وكحولك وأكوابك: من «الإنتاج» ← تبويب «المواد الخام» ← إضافة مادة خام (اختر منتج موجوداً أو أنشئ جديداً).' },
      { title: 'الصيغة', desc: 'تبويب «الصيغ» ← إضافة صيغة: اكتب اسم العطر، وحدّد المنتج المستهدف وحجم الدفعة (مثال: ١٠٠٠ مل).' },
      { title: 'المكونات', desc: 'أضف مكونات الصيغة: زيت كذا ٤٠٪، كحول ٥٠٪، مثبت ١٠٪ — احفظ الصيغة.' },
      { title: 'تنفيذ إنتاج', desc: 'اضغط «إنتاج» ← اختر الصيغة والكمية المخططة والزجاجة ← ستظهر معاينة المخزون والتكلفة.' },
      { title: 'تأكيد', desc: 'بعد التأكيد: تُخصم المواد الخام من المخزون، ويُضاف العطر الجاهز جاهزاً للبيع.' },
      { title: 'سجل الدفعات', desc: 'كل دفعة تظهر في تبويب «دفعة الإنتاج» مع تفاصيل التكلفة لاحقاً.' },
    ],
    stepsEn: [
      { title: 'Raw materials', desc: 'Register oils, alcohol and caps: Production → "Raw Materials" tab → Add (pick an existing product or create new).' },
      { title: 'Formula', desc: 'Formulas tab → Add formula: name the perfume, set target product and batch size (e.g. 1000 ml).' },
      { title: 'Components', desc: 'Add formula parts: oil 40%, alcohol 50%, fixative 10% — then save.' },
      { title: 'Run production', desc: 'Click "Produce" → choose formula, planned quantity and bottle → stock & cost preview appears.' },
      { title: 'Confirm', desc: 'After confirming: raw materials are deducted and the finished perfume becomes sellable.' },
      { title: 'Batch history', desc: 'Every batch is listed in the "Production Batches" tab with full cost details.' },
    ],
    tipAr: 'المعاينة تخبرك مسبقاً إذا كانت المواد لا تكفي — لا تؤكد قبل رؤية «المخزون كافٍ».',
    tipEn: 'The preview tells you in advance if materials are insufficient — do not confirm until you see "stock sufficient".',
  },
  {
    key: 'customerCredit',
    icon: '👥',
    titleAr: 'بيع آجل للعملاء',
    titleEn: 'Selling on Credit',
    introAr: 'البيع بالآجل يسجَّل تلقائياً في حساب العميل.',
    introEn: 'Credit sales are recorded automatically on the customer account.',
    stepsAr: [
      { title: 'أضف العميل', desc: 'افتح «العملاء» واضغط إضافة: الاسم والهاتف (واسم واتساب إن وجد).' },
      { title: 'اختر العميل في البيع', desc: 'في نقطة البيع اضغط خانة العميل واختر اسمه قبل إتمام البيع.' },
      { title: 'ادفع بالآجل', desc: 'في شاشة الدفع اختر «آجل» أو ادفع جزءاً من المبلغ — المتبقي يُسجَّل كدين.' },
      { title: 'تحصيل الدفعة', desc: 'من صفحة العميل افتح «كشف الحساب» لرؤية الرصيد وتسجيل أي دفعة لاحقة.' },
    ],
    stepsEn: [
      { title: 'Add customer', desc: 'Open "Customers" → Add: name and phone.' },
      { title: 'Select in POS', desc: 'In POS click the customer field and pick the name before completing the sale.' },
      { title: 'Pay on credit', desc: 'In the payment screen choose "Credit" or pay part — the rest is recorded as debt.' },
      { title: 'Collect later', desc: 'Open the customer statement to see the balance and record later payments.' },
    ],
  },
  {
    key: 'expenses',
    icon: '💸',
    titleAr: 'المصروفات والصندوق',
    titleEn: 'Expenses & Cash',
    introAr: 'سجّل كل مصروف (إيجار، كهرباء، نقل) لتكون نظرة أرباحك صحيحة.',
    introEn: 'Record every expense (rent, electricity, transport) so your profit is accurate.',
    stepsAr: [
      { title: 'مصروف جديد', desc: 'افتح «المصروفات» ← إضافة، اختر الفئة (إيجار/كهرباء/نقل/أخرى) وادخل المبلغ.' },
      { title: 'يُخصم من الصندوق', desc: 'المصروف يُخصم من رصيد الصندوق ويظهر في تقرير المصروفات.' },
      { title: 'إغلاق الجلسة', desc: 'في نهاية اليوم: الصندوق ← «إغلاق جلسة» ← ادخل المبلغ الفعلي — يظهر الفرق عن المتوقع.' },
    ],
    stepsEn: [
      { title: 'New expense', desc: 'Open "Expenses" → Add, pick a category and enter the amount.' },
      { title: 'Deducted from cash', desc: 'The expense is deducted from cash balance and appears in the expense report.' },
      { title: 'Close session', desc: 'End of day: Cash → "Close session" → enter actual cash — the difference vs expected shows.' },
    ],
    tipAr: 'أغلق الجلسة كل يوم حتى تبقى أرباحك صحيحة.',
    tipEn: 'Close the session daily so your profit numbers stay accurate.',
  },
  {
    key: 'reports',
    icon: '📈',
    titleAr: 'التقارير واتخاذ القرار',
    titleEn: 'Reports & Decisions',
    introAr: 'التقارير تخبرك ماذا تبيع أكثر، وماذا يجب أن تشتري.',
    introEn: 'Reports tell you what sells best and what to restock.',
    stepsAr: [
      { title: 'لوحة التحكم', desc: 'أول شاشة: مبيعات اليوم، أرباح اليوم، المنتجات الأكثر مبيعاً، والتنبيهات.' },
      { title: 'تقرير المبيعات', desc: 'صفحة التقارير ← مبيعات: حسب التاريخ والعميل وطريقة الدفع.' },
      { title: 'تقرير الأرباح', desc: 'تعرف صافي الربح بعد خصم التكلفة والمصروفات.' },
      { title: 'المنتجات بمخزون منخفض', desc: 'من لوحة التحكم: أي منتج وصل للحد الأدنى ← حان وقت إعادة الشراء.' },
    ],
    stepsEn: [
      { title: 'Dashboard', desc: 'First screen: today sales, today profit, top products and alerts.' },
      { title: 'Sales report', desc: 'Reports → Sales: filter by date, customer and payment method.' },
      { title: 'Profit report', desc: 'See net profit after cost and expenses are deducted.' },
      { title: 'Low stock', desc: 'Dashboard: any product at minimum level → time to reorder.' },
    ],
  },
  {
    key: 'backup',
    icon: '💾',
    titleAr: 'النسخ الاحتياطي',
    titleEn: 'Backup',
    introAr: 'بياناتك محفوظة على جهازك فقط — انسخها بانتظام كي لا تفقدها.',
    introEn: 'Your data lives only on this device — back it up regularly so you never lose it.',
    stepsAr: [
      { title: 'إنشاء نسخة', desc: 'الإعدادات ← النسخ الاحتياطي ← «إنشاء نسخة احتياطية».' },
      { title: 'احفظها خارج الجهاز', desc: 'انسخ ملف النسخة إلى فلاشة أو خدمة سحابية أسبوعياً.' },
      { title: 'الاستعادة', desc: 'عند تغيير الجهاز أو حدوث مشكلة: «استعادة» واختر ملف النسخة.' },
    ],
    stepsEn: [
      { title: 'Create backup', desc: 'Settings → Backup → "Create backup".' },
      { title: 'Keep it off-device', desc: 'Copy the backup file to a USB drive or cloud service weekly.' },
      { title: 'Restore', desc: 'On a new device or after a problem: "Restore" and pick the backup file.' },
    ],
    tipAr: 'قاعدة ذهبية: نسخة احتياطية كل أسبوع على الأقل.',
    tipEn: 'Golden rule: at least one backup every week.',
  },
  {
    key: 'shortcuts',
    icon: '⌨️',
    titleAr: 'اختصارات ولوحات المفاتيح',
    titleEn: 'Keyboard Shortcuts',
    introAr: 'اختصارات تسرّع عملك اليومي.',
    introEn: 'Shortcuts that speed up daily work.',
    stepsAr: [
      { title: 'F2', desc: 'التركيز على خانة البحث في نقطة البيع.' },
      { title: 'Enter في الباركود', desc: 'بعد مسح الباركود مباشرة، Enter يضيف المنتج للسلة.' },
      { title: '+ و −', desc: 'تعديل الكميات في السلة بالضغط على الأزرار.' },
      { title: 'F2 ثم الكتابة', desc: 'يمكنك البحث بالاسم أو SKU أو الباركود معاً.' },
    ],
    stepsEn: [
      { title: 'F2', desc: 'Focus the search box in POS.' },
      { title: 'Enter after scan', desc: 'After scanning a barcode, Enter adds the product to the cart.' },
      { title: '+ and −', desc: 'Adjust quantities in the cart using the buttons.' },
      { title: 'Search by anything', desc: 'Search by name, SKU or barcode in the same box.' },
    ],
  },
];

export default function HelpPage() {
  const { language } = useAuthStore();
  const [openSection, setOpenSection] = useState<string | null>('setup');
  const isAr = language === 'ar';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card-modern p-6 bg-gradient-to-l from-violet-500/10 to-fuchsia-500/10 border-primary/20">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-2xl shadow-glow">📖</span>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'inherit', background: 'none', WebkitTextFillColor: 'inherit' }}>
              {isAr ? 'دليل الاستخدام' : 'User Guide'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAr
                ? 'خطوات بسيطة لكل مهمة — اضغط أي قسم لفتحه'
                : 'Simple steps for every task — click any section to open it'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setOpenSection(s.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                openSection === s.key
                  ? 'text-white bg-gradient-to-l from-violet-500 to-fuchsia-500 shadow-glow'
                  : 'bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.icon} {isAr ? s.titleAr : s.titleEn}
            </button>
          ))}
        </div>
      </div>

      {sections.map(section => {
        const isOpen = openSection === section.key;
        const steps = isAr ? section.stepsAr : section.stepsEn;

        return (
          <div
            key={section.key}
            className={`card-modern overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-card-hover' : ''}`}
          >
            <button
              onClick={() => setOpenSection(isOpen ? null : section.key)}
              className="w-full flex items-center gap-3 p-4 text-right hover:bg-muted/30 transition-colors"
            >
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-lg shrink-0">
                {section.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{isAr ? section.titleAr : section.titleEn}</h3>
                <p className="text-xs text-muted-foreground truncate">{isAr ? section.introAr : section.introEn}</p>
              </div>
              <span className={`text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 animate-slide-up">
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3 items-start p-3 rounded-xl bg-muted/30 border border-border/60">
                      <span className="w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold">{step.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {(isAr ? section.tipAr : section.tipEn) && (
                  <div className="mt-3 flex gap-2 items-start p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-sm">💡</span>
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      {isAr ? section.tipAr : section.tipEn}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="card-modern p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center text-xs">❓</span>
          {isAr ? 'ترتيب العمل اليومي الموصى به' : 'Recommended daily workflow'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-center">
          {(isAr ? [
            ['1️⃣', 'فتح الصندوق'],
            ['2️⃣', 'البيع'],
            ['3️⃣', 'تسجيل المشتريات'],
            ['4️⃣', 'المصروفات'],
            ['5️⃣', 'إغلاق الصندوق'],
          ] : [
            ['1️⃣', 'Open cash'],
            ['2️⃣', 'Sell'],
            ['3️⃣', 'Record purchases'],
            ['4️⃣', 'Expenses'],
            ['5️⃣', 'Close cash'],
          ]).map(([emoji, label], i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/60">
              <div className="text-xl">{emoji}</div>
              <div className="text-xs font-bold mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}