import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { getDb } from '../database/wrapper';
import fs from 'fs';
import path from 'path';

interface BrandingConfig {
  businessName?: string;
  subtitle?: string;
  footer?: string;
  showLogo?: boolean;
  showPhone?: boolean;
  showAddress?: boolean;
  showTaxNumber?: boolean;
  showCommercialNumber?: boolean;
}

function getStoreBranding(): Record<string, unknown> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM store_settings WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) {
    return { store_name: 'محل العطور', address: '', phone1: '', tax_number: '', commercial_number: '', logo_path: '', receipt_width: '80mm', receipt_name: '', receipt_subtitle: '', receipt_footer: '' };
  }
  return row;
}

function buildBranding(branding?: BrandingConfig): Record<string, unknown> {
  const store = getStoreBranding();
  return {
    shopName: branding?.businessName || store.receipt_name || store.store_name || 'محل العطور',
    subtitle: branding?.subtitle || store.receipt_subtitle || '',
    footer: branding?.footer || store.receipt_footer || '',
    logoPath: store.logo_path || '',
    address: store.address || '',
    phone: store.phone1 || '',
    taxNumber: store.tax_number || '',
    commercialNumber: store.commercial_number || '',
    receiptWidth: store.receipt_width || '80mm',
    showLogo: store.show_logo !== 0,
    showPhone: store.show_phone !== 0,
    showAddress: store.show_address !== 0,
    showTaxNumber: store.show_tax_number !== 0,
    showCommercialNumber: store.show_commercial_number !== 0,
  };
}

function logoToBase64(logoPath: string): string {
  try {
    if (logoPath && fs.existsSync(logoPath)) {
      const ext = path.extname(logoPath).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const data = fs.readFileSync(logoPath);
      return `data:image/${mime};base64,${data.toString('base64')}`;
    }
  } catch { /* ignore */ }
  return '';
}

function generateReceiptHTML(data: Record<string, unknown>, branding: Record<string, unknown>): string {
  const logoBase64 = branding.logoPath ? logoToBase64(branding.logoPath as string) : '';
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const width = branding.receiptWidth || '80mm';
  const isRtl = true;

  let logoHTML = '';
  if (branding.showLogo && logoBase64) {
    logoHTML = `<div style="text-align:center;margin-bottom:8px"><img src="${logoBase64}" style="max-width:60%;max-height:50px;object-fit:contain" /></div>`;
  }

  let phoneHTML = '';
  if (branding.showPhone && branding.phone) {
    phoneHTML = `<div style="text-align:center;font-size:11px;color:#555">${branding.phone}</div>`;
  }

  let addressHTML = '';
  if (branding.showAddress && branding.address) {
    addressHTML = `<div style="text-align:center;font-size:11px;color:#555">${branding.address}</div>`;
  }

  let taxHTML = '';
  if (branding.showTaxNumber && branding.taxNumber) {
    taxHTML = `<div style="text-align:center;font-size:10px;color:#777">الرقم الضريبي: ${branding.taxNumber}</div>`;
  }

  const unitLabels: Record<string, string> = { g: 'جرام', kg: 'كيلو', ml: 'مل', l: 'لتر', piece: '' };

  const itemsHTML = items.map(item => {
    const unitLabel = item.unit && item.unit !== 'piece' ? (unitLabels[item.unit as string] || item.unit) : '';
    const sizeLabel = item.size ? `${item.size} ${item.sizeUnit || ''}` : '';
    const detailLine = [sizeLabel, unitLabel ? `(${unitLabel})` : ''].filter(Boolean).join(' ');
    const qtyLine = `× ${item.quantity}`;
    const unitPrice = Number(item.unitPrice);
    const total = Number(item.total);
    const quantity = Number(item.quantity);
    const showAtPrice = quantity > 0 && Math.abs(unitPrice - total / quantity) > 0.01;

    return `
    <div style="padding:3px 0;border-bottom:1px dashed #ddd;font-size:12px">
      <div style="display:flex;justify-content:space-between">
        <div style="flex:1">
          <div style="font-weight:bold">${item.name}</div>
          <div style="font-size:10px;color:#666;margin-top:1px">${detailLine ? detailLine + ' ' : ''}${qtyLine}${showAtPrice ? ` <span style="color:#888">@ ${unitPrice.toFixed(2)}</span>` : ''}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;font-weight:bold">${total.toFixed(2)}</div>
      </div>
    </div>`;
  }).join('');

  const paymentMethods: Record<string, string> = { cash: 'نقدي', card: 'بطاقة ائتمان', transfer: 'تحويل بنكي' };
  const paymentLabel = paymentMethods[data.paymentMethod as string] || data.paymentMethod || 'نقدي';

  return `
<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<style>
  @page { size: ${width} auto; margin: 3mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; width: ${width}; padding: 3mm; direction: rtl; }
  .receipt { text-align: center; }
  .divider { border-top: 1px dashed #aaa; margin: 6px 0; }
  .bold { font-weight: bold; }
  .large { font-size: 16px; }
  .footer { margin-top: 10px; font-size: 11px; color: #555; white-space: pre-line; }
</style>
</head>
<body>
<div class="receipt">
  ${logoHTML}
  <div style="font-size:18px;font-weight:bold;margin:4px 0">${branding.shopName}</div>
  ${branding.subtitle ? `<div style="font-size:12px;color:#555">${branding.subtitle}</div>` : ''}
  ${phoneHTML}
  ${addressHTML}
  ${taxHTML}

  <div class="divider"></div>

  <div style="font-size:11px;text-align:left">
    <div style="display:flex;justify-content:space-between"><span>رقم الفاتورة:</span><span>${data.invoiceNumber}</span></div>
    <div style="display:flex;justify-content:space-between"><span>التاريخ:</span><span>${data.date}</span></div>
    ${data.cashier ? `<div style="display:flex;justify-content:space-between"><span>الكاشير:</span><span>${data.cashier}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  ${itemsHTML}

  <div class="divider"></div>

  <div style="font-size:12px;text-align:left">
    <div style="display:flex;justify-content:space-between"><span>المجموع الفرعي:</span><span>${Number(data.subtotal).toFixed(2)}</span></div>
    ${Number(data.discount) > 0 ? `<div style="display:flex;justify-content:space-between;color:red"><span>الخصم:</span><span>-${Number(data.discount).toFixed(2)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:4px"><span>الإجمالي:</span><span>${Number(data.total).toFixed(2)}</span></div>
  </div>

  <div class="divider"></div>

  <div style="font-size:12px;text-align:left">
    <div style="display:flex;justify-content:space-between"><span>الدفع:</span><span>${paymentLabel}</span></div>
    <div style="display:flex;justify-content:space-between"><span>المدفوع:</span><span>${Number(data.paid).toFixed(2)}</span></div>
    ${Number(data.change) > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:bold"><span>المتبقي:</span><span>${Number(data.change).toFixed(2)}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  ${branding.footer ? `<div class="footer">${branding.footer}</div>` : ''}

  <div style="margin-top:8px;font-size:10px;color:#999">شكرا لزيارتكم</div>
</div>
</body>
</html>`;
}

function generateInvoiceHTML(data: Record<string, unknown>, branding: Record<string, unknown>): string {
  const logoBase64 = branding.logoPath ? logoToBase64(branding.logoPath as string) : '';
  const items = (data.items as Array<Record<string, unknown>>) || [];

  let logoHTML = '';
  if (branding.showLogo && logoBase64) {
    logoHTML = `<div style="text-align:center;margin-bottom:8px"><img src="${logoBase64}" style="max-width:40%;max-height:60px;object-fit:contain" /></div>`;
  }

  const itemsHTML = items.map((item, i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px;text-align:center">${i + 1}</td>
      <td style="padding:6px">${item.name || item.productName || ''}</td>
      <td style="padding:6px;text-align:center">${item.quantity}</td>
      <td style="padding:6px;text-align:center">${Number(item.unitPrice || item.unit_cost || 0).toFixed(2)}</td>
      <td style="padding:6px;text-align:center">${Number(item.total || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #333; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f5f5f5; padding: 8px 6px; text-align: center; border-bottom: 2px solid #333; font-size: 12px; }
  .totals { text-align: left; font-size: 14px; }
  .totals div { padding: 4px 0; }
  .totals .total-row { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px; }
  .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 11px; color: #777; }
</style>
</head>
<body>
<div class="header">
  ${logoHTML}
  <h1 style="font-size:24px;margin:5px 0">${branding.shopName}</h1>
  ${branding.subtitle ? `<div style="font-size:13px;color:#555">${branding.subtitle}</div>` : ''}
  ${branding.phone ? `<div style="font-size:12px;color:#555">هاتف: ${branding.phone}</div>` : ''}
  ${branding.address ? `<div style="font-size:12px;color:#555">${branding.address}</div>` : ''}
  ${branding.taxNumber ? `<div style="font-size:11px;color:#777">الرقم الضريبي: ${branding.taxNumber}</div>` : ''}
  ${branding.commercialNumber ? `<div style="font-size:11px;color:#777">السجل التجاري: ${branding.commercialNumber}</div>` : ''}
</div>

<div class="info">
  <div>
    <div><strong>رقم الفاتورة:</strong> ${data.invoiceNumber}</div>
    <div><strong>التاريخ:</strong> ${data.date}</div>
    ${data.customer ? `<div><strong>العميل:</strong> ${data.customer}</div>` : ''}
  </div>
  <div style="text-align:left">
    ${data.cashier ? `<div><strong>الكاشير:</strong> ${data.cashier}</div>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>المنتج</th>
      <th>الكمية</th>
      <th>السعر</th>
      <th>الإجمالي</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHTML}
  </tbody>
</table>

<div class="totals">
  <div>المجموع الفرعي: ${Number(data.subtotal).toFixed(2)} ج.م</div>
  ${Number(data.discount) > 0 ? `<div style="color:red">الخصم: -${Number(data.discount).toFixed(2)} ج.م</div>` : ''}
  ${Number(data.tax) > 0 ? `<div>الضريبة: ${Number(data.tax).toFixed(2)} ج.م</div>` : ''}
  <div class="total-row">الإجمالي: ${Number(data.total).toFixed(2)} ج.م</div>
  <div style="margin-top:8px">المدفوع: ${Number(data.paid).toFixed(2)} ج.م</div>
  ${Number(data.remaining) > 0 ? `<div style="color:red">المتبقي: ${Number(data.remaining).toFixed(2)} ج.م</div>` : ''}
</div>

${branding.footer ? `<div class="footer">${branding.footer}</div>` : ''}
</body>
</html>`;
}

async function printWindow(html: string, silent: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: { offscreen: true },
    });

    printWindow.webContents.on('did-finish-load', async () => {
      try {
        await printWindow.webContents.print({
          silent,
          printBackground: true,
          margins: { marginType: 'none' },
        });
        printWindow.close();
        resolve(true);
      } catch {
        printWindow.close();
        resolve(false);
      }
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

export function registerPrintHandlers(): void {
  ipcMain.handle('print:receipt', async (_event, data: Record<string, unknown>) => {
    const branding = buildBranding();
    const html = generateReceiptHTML(data, branding);
    const success = await printWindow(html);
    return { success };
  });

  ipcMain.handle('print:invoice', async (_event, data: Record<string, unknown>) => {
    const branding = buildBranding();
    const html = generateInvoiceHTML(data, branding);
    const success = await printWindow(html);
    return { success };
  });

  ipcMain.handle('print:getPrinters', async () => {
    const printers = BrowserWindow.getAllWindows()[0]?.webContents.getPrintersAsync();
    if (printers) {
      return printers;
    }
    return [{ name: 'Default Printer', displayName: 'الطابعة الافتراضية' }];
  });

  ipcMain.handle('print:test', async (_event, printerName: string) => {
    return { success: true, message: 'Test print sent' };
  });

  ipcMain.handle('print:savePDF', async (event, data: { data: number[]; defaultFilename: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error('No active window');
    }

    const desktopPath = app.getPath('desktop');
    const defaultPath = path.join(desktopPath, data.defaultFilename || 'receipt.pdf');

    const result = await dialog.showSaveDialog(window, {
      title: 'حفظ الإيصال كـ PDF',
      defaultPath,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    const uint8Array = new Uint8Array(data.data);
    fs.writeFileSync(result.filePath, Buffer.from(uint8Array));

    return { success: true, filePath: result.filePath };
  });
}
