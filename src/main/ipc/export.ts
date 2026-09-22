import { ipcMain, dialog } from 'electron';
import { getDb } from '../database/wrapper';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

function isPathWithinUserData(filePath: string): boolean {
  const userData = app.getPath('userData');
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(userData);
  return resolved.startsWith(allowed + path.sep) || resolved === allowed;
}

function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const sanitized = str.replace(/^[=+\-@\t\r]/, '').replace(/\r?\n/g, ' ');
  return sanitized.includes(',') || sanitized.includes('"')
    ? `"${sanitized.replace(/"/g, '""')}"`
    : sanitized;
}

export function registerExportHandlers(): void {
  ipcMain.handle('export:csv', async (_event, type: string, filters?: Record<string, unknown>) => {
    const db = getDb();
    let data: Array<Record<string, unknown>> = [];
    let filename = '';

    switch (type) {
      case 'sales': {
        let salesQuery = `
          SELECT s.invoice_number, s.date, c.name_ar as customer, u.display_name as cashier,
                 s.subtotal, s.discount, s.tax_amount, s.total, s.paid, s.remaining, s.payment_status, s.payment_method
          FROM sales s
          LEFT JOIN customers c ON c.id = s.customer_id
          JOIN users u ON u.id = s.user_id
          WHERE 1=1
        `;
        const salesParams: unknown[] = [];
        if (filters?.from) { salesQuery += ' AND s.date >= ?'; salesParams.push(filters.from); }
        if (filters?.to) { salesQuery += ' AND s.date <= ?'; salesParams.push(filters.to); }
        salesQuery += ' ORDER BY s.date DESC';
        data = db.prepare(salesQuery).all(...salesParams);
        filename = 'sales.csv';
        break;
      }
      case 'purchases': {
        let purchasesQuery = `
          SELECT p.invoice_number, p.date, s.name_ar as supplier, p.subtotal, p.discount, p.total, p.paid, p.remaining, p.status
          FROM purchase_invoices p
          JOIN suppliers s ON s.id = p.supplier_id
          WHERE 1=1
        `;
        const purchasesParams: unknown[] = [];
        if (filters?.from) { purchasesQuery += ' AND p.date >= ?'; purchasesParams.push(filters.from); }
        if (filters?.to) { purchasesQuery += ' AND p.date <= ?'; purchasesParams.push(filters.to); }
        purchasesQuery += ' ORDER BY p.date DESC';
        data = db.prepare(purchasesQuery).all(...purchasesParams);
        filename = 'purchases.csv';
        break;
      }
      case 'inventory': {
        data = db.prepare(`
          SELECT p.sku, p.name_ar, p.name_en, c.name_ar as category, b.name_ar as brand,
                 p.current_stock, p.cost, p.retail_price, p.wholesale_price
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          LEFT JOIN brands b ON b.id = p.brand_id
          WHERE p.active = 1
          ORDER BY p.name_ar
        `).all();
        filename = 'inventory.csv';
        break;
      }
      case 'customers': {
        data = db.prepare('SELECT name_ar, name_en, phone, whatsapp, address, current_balance FROM customers WHERE active = 1 ORDER BY name_ar').all();
        filename = 'customers.csv';
        break;
      }
      case 'suppliers': {
        data = db.prepare('SELECT name_ar, name_en, phone, whatsapp, address, current_balance FROM suppliers WHERE active = 1 ORDER BY name_ar').all();
        filename = 'suppliers.csv';
        break;
      }
      case 'expenses': {
        data = db.prepare(`
          SELECT e.date, ec.name_ar as category, e.amount, e.payment_method, e.description, u.display_name as user
          FROM expenses e
          JOIN expense_categories ec ON ec.id = e.category_id
          LEFT JOIN users u ON u.id = e.created_by
          ORDER BY e.date DESC
        `).all();
        filename = 'expenses.csv';
        break;
      }
      case 'audit': {
        let auditQuery = `
          SELECT al.created_at, al.action, al.entity, al.entity_id, al.details, u.display_name as user
          FROM audit_logs al
          LEFT JOIN users u ON u.id = al.user_id
          WHERE 1=1
        `;
        const auditParams: unknown[] = [];
        if (filters?.from) { auditQuery += ' AND al.created_at >= ?'; auditParams.push(filters.from); }
        if (filters?.to) { auditQuery += ' AND al.created_at <= ?'; auditParams.push((filters.to as string) + 'T23:59:59'); }
        if (filters?.entity) { auditQuery += ' AND al.entity = ?'; auditParams.push(filters.entity); }
        if (filters?.userId) { auditQuery += ' AND al.user_id = ?'; auditParams.push(filters.userId); }
        auditQuery += ' ORDER BY al.created_at DESC';
        data = db.prepare(auditQuery).all(...auditParams);
        filename = 'audit_log.csv';
        break;
      }
      case 'production': {
        let prodQuery = `
          SELECT pb.batch_number, f.name_ar as formula_name, p.name_ar as product_name,
                 pb.quantity_planned, pb.quantity_produced, pb.total_cost, pb.cost_per_unit,
                 pb.status, pb.created_at, u.display_name as user_name
          FROM production_batches pb
          JOIN formulas f ON f.id = pb.formula_id
          LEFT JOIN products p ON p.id = pb.target_product_id
          LEFT JOIN users u ON u.id = pb.created_by
          WHERE 1=1
        `;
        const prodParams: unknown[] = [];
        if (filters?.from) { prodQuery += ' AND pb.created_at >= ?'; prodParams.push(filters.from); }
        if (filters?.to) { prodQuery += ' AND pb.created_at <= ?'; prodParams.push((filters.to as string) + 'T23:59:59'); }
        prodQuery += ' ORDER BY pb.created_at DESC';
        data = db.prepare(prodQuery).all(...prodParams);
        filename = 'production.csv';
        break;
      }
      case 'cash': {
        let cashQuery = `
          SELECT cs.opened_at, cs.closed_at, cs.opening_cash, cs.closing_cash,
                 cs.expected_cash, cs.difference, cs.status,
                 cr.name as register_name, u.display_name as user_name
          FROM cash_sessions cs
          JOIN cash_registers cr ON cr.id = cs.register_id
          JOIN users u ON u.id = cs.user_id
          WHERE 1=1
        `;
        const cashParams: unknown[] = [];
        if (filters?.from) { cashQuery += ' AND cs.opened_at >= ?'; cashParams.push(filters.from); }
        if (filters?.to) { cashQuery += ' AND cs.opened_at <= ?'; cashParams.push((filters.to as string) + 'T23:59:59'); }
        cashQuery += ' ORDER BY cs.opened_at DESC';
        data = db.prepare(cashQuery).all(...cashParams);
        filename = 'cash_register.csv';
        break;
      }
      default:
        throw new Error('Unknown export type');
    }

    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.map(h => sanitizeCsvValue(h)).join(','),
      ...data.map(row =>
        headers.map(h => sanitizeCsvValue(row[h])).join(',')
      )
    ].join('\n');

    const result = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, '\uFEFF' + csvContent, 'utf8');
      return { success: true, path: result.filePath };
    }

    return { success: false };
  });

  ipcMain.handle('import:products', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    if (!isPathWithinUserData(filePath)) {
      throw new Error('Import file must be within application data directory');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('File too large (max 10MB)');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['name_ar', 'sku'];
    for (const h of requiredHeaders) {
      if (!headers.includes(h) && !headers.includes(h.replace('_', ''))) {
        throw new Error(`Missing required column: ${h}`);
      }
    }

    const db = getDb();
    const now = new Date().toISOString();

    const results = { success: 0, errors: [] as string[] };

    const importTx = db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          const nameAr = row.name_ar || row.nameAr || '';
          if (!nameAr) {
            results.errors.push(`Row ${i + 1}: Missing name_ar`);
            continue;
          }

          const sku = row.sku || `PRD-${Date.now()}-${i}`;
          const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
          if (existing) {
            results.errors.push(`Row ${i + 1}: Duplicate SKU ${sku}`);
            continue;
          }

          const retailPrice = parseFloat(row.retail_price || row.retailPrice || '0');
          const wholesalePrice = parseFloat(row.wholesale_price || row.wholesalePrice || '0');
          const cost = parseFloat(row.cost || '0');
          const stock = parseFloat(row.stock || row.current_stock || '0');

          if (isNaN(retailPrice) || retailPrice < 0) {
            results.errors.push(`Row ${i + 1}: Invalid retail price`);
            continue;
          }
          if (isNaN(stock) || stock < 0) {
            results.errors.push(`Row ${i + 1}: Invalid stock quantity`);
            continue;
          }

          db.prepare(`
            INSERT INTO products (sku, name_ar, name_en, barcode, retail_price, wholesale_price, cost, current_stock, unit, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(
            sku,
            nameAr,
            row.name_en || row.nameEn || '',
            row.barcode || null,
            retailPrice,
            wholesalePrice,
            cost,
            stock,
            row.unit || 'piece',
            now, now
          );
          results.success++;
        } catch (e) {
          results.errors.push(`Row ${i + 1}: ${(e as Error).message}`);
        }
      }
    });

    importTx();
    return results;
  });
}
