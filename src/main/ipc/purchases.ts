import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel, toCamelAll } from './toCamel';

function getLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLocalTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

export function registerPurchaseHandlers(): void {
  ipcMain.handle('purchases:list', async (_event, filters?: { supplierId?: number; from?: string; to?: string }) => {
    const db = getDb();
    let query = `
      SELECT p.*, s.name_ar as supplier_name, s.name_en as supplier_name_en
      FROM purchase_invoices p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.supplierId) {
      query += ' AND p.supplier_id = ?';
      params.push(filters.supplierId);
    }
    if (filters?.from) {
      query += ' AND p.date >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND p.date <= ?';
      params.push(filters.to);
    }

    query += ' ORDER BY p.created_at DESC';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('purchases:getById', async (_event, id: number) => {
    const db = getDb();
    const invoice = db.prepare(`
      SELECT p.*, s.name_ar as supplier_name
      FROM purchase_invoices p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?
    `).get(id);

    if (!invoice) return null;

    const items = db.prepare(`
      SELECT pi.*, pr.name_ar as product_name, pr.name_en as product_name_en, pr.item_code, pr.item_code_2, pr.sku
      FROM purchase_invoice_items pi
      JOIN products pr ON pr.id = pi.product_id
      WHERE pi.purchase_invoice_id = ?
    `).all(id).map(toCamel);

    return { ...toCamel(invoice as Record<string, unknown>), items };
  });

  ipcMain.handle('purchases:create', async (_event, purchase: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const today = getLocalDate();

    const items = purchase.items as Array<Record<string, unknown>>;
    if (!items || items.length === 0) {
      throw new Error('Purchase must have at least one item');
    }

    let subtotal = 0;
    for (const item of items) {
      const qty = (item.quantity as number) || 0;
      const cost = (item.unitCost as number) || 0;
      const itemDiscount = (item.discount as number) || 0;
      subtotal += (qty * cost) - itemDiscount;
    }

    const discount = (purchase.discount as number) || 0;
    const total = subtotal - discount;
    const paid = (purchase.paid as number) || 0;

    if (paid > total) {
      throw new Error(`Payment (${paid}) cannot exceed total (${total})`);
    }

    const remaining = total - paid;
    const invoiceNumber = generateInvoiceNumber(db, 'PO');

    const createPurchase = db.transaction(() => {
      for (const item of items) {
        const product = db.prepare('SELECT id FROM products WHERE id = ?').get(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
      }

      const result = db.prepare(`
        INSERT INTO purchase_invoices (invoice_number, supplier_id, date, subtotal, discount, total, paid, remaining, status, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber, purchase.supplierId, purchase.date || today,
        subtotal, discount, total, paid, remaining,
        remaining <= 0 ? 'paid' : 'partial', purchase.notes, purchase.userId, now, now
      );

      const invoiceId = result.lastInsertRowid as number;

      const insertItem = db.prepare(`
        INSERT INTO purchase_invoice_items (purchase_invoice_id, product_id, quantity, unit_cost, discount, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reference_type, reference_id, created_at)
        VALUES (?, 'PURCHASE', ?, ?, ?, 'purchase', ?, ?)
      `);

      const updateStock = db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?');

      const updateWAC = db.prepare(`
        UPDATE products SET weighted_avg_cost = ?, cost = ?, updated_at = ? WHERE id = ?
      `);

      for (const item of items) {
        const itemTotal = ((item.quantity as number) * (item.unitCost as number)) - ((item.discount as number) || 0);
        insertItem.run(invoiceId, item.productId, item.quantity, item.unitCost, item.discount || 0, itemTotal);

        const product = db.prepare('SELECT current_stock, weighted_avg_cost FROM products WHERE id = ?').get(item.productId) as { current_stock: number; weighted_avg_cost: number };

        updateStock.run(item.quantity, now, item.productId);

        const newStock = product.current_stock + (item.quantity as number);
        const newWAC = newStock > 0
          ? ((product.weighted_avg_cost * product.current_stock) + ((item.unitCost as number) * (item.quantity as number))) / newStock
          : (item.unitCost as number);

        updateWAC.run(newWAC, newWAC, now, item.productId);

        insertMovement.run(item.productId, item.quantity, product.current_stock, newStock, invoiceId, now);
      }

      if (purchase.supplierId) {
        const supplier = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(purchase.supplierId as number) as { current_balance: number };
        const newBalance = supplier.current_balance + remaining;
        db.prepare('UPDATE suppliers SET current_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, purchase.supplierId);

        db.prepare(`
          INSERT INTO supplier_transactions (supplier_id, type, amount, balance_after, reference_type, reference_id, description, created_by, created_at)
          VALUES (?, 'PURCHASE', ?, ?, 'purchase', ?, ?, ?, ?)
        `).run(purchase.supplierId, remaining, newBalance, invoiceId, `Purchase ${invoiceNumber}`, purchase.userId, now);
      }

      if (paid > 0) {
        db.prepare(`
          INSERT INTO purchase_payments (purchase_invoice_id, supplier_id, amount, payment_method, date, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(invoiceId, purchase.supplierId, paid, purchase.paymentMethod || 'cash', purchase.date || today, purchase.userId, now);
      }

      createJournalEntriesForPurchase(db, invoiceId, purchase.supplierId as number, total, paid, remaining, purchase.date as string || today, purchase.userId as number);

      logAudit(purchase.userId as number, 'purchase_created', 'purchase', invoiceId, `Purchase ${invoiceNumber} created`);
      return invoiceId;
    });

    return createPurchase();
  });

  ipcMain.handle('purchases:paySupplier', async (_event, payment: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const today = getLocalDate();

    const payTx = db.transaction(() => {
      const invoice = db.prepare('SELECT remaining FROM purchase_invoices WHERE id = ?').get(payment.purchaseInvoiceId) as { remaining: number } | undefined;
      if (!invoice) {
        throw new Error(`Purchase invoice not found: ${payment.purchaseInvoiceId}`);
      }
      if ((payment.amount as number) <= 0) {
        throw new Error('Payment amount must be positive');
      }
      if ((payment.amount as number) > invoice.remaining) {
        throw new Error(`Payment (${payment.amount}) cannot exceed remaining balance (${invoice.remaining})`);
      }

      db.prepare(`
        INSERT INTO purchase_payments (purchase_invoice_id, supplier_id, amount, payment_method, date, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payment.purchaseInvoiceId, payment.supplierId, payment.amount,
        payment.paymentMethod || 'cash', payment.date || today,
        payment.notes, payment.userId, now
      );

      const newRemaining = invoice.remaining - (payment.amount as number);
      db.prepare('UPDATE purchase_invoices SET paid = paid + ?, remaining = ?, status = ?, updated_at = ? WHERE id = ?').run(
        payment.amount, newRemaining, newRemaining <= 0 ? 'paid' : 'partial', now, payment.purchaseInvoiceId
      );

      if (payment.supplierId) {
        const supplier = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(payment.supplierId) as { current_balance: number };
        const newBalance = supplier.current_balance - (payment.amount as number);
        db.prepare('UPDATE suppliers SET current_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, payment.supplierId);

        db.prepare(`
          INSERT INTO supplier_transactions (supplier_id, type, amount, balance_after, reference_type, reference_id, description, created_by, created_at)
          VALUES (?, 'PAYMENT', ?, ?, 'purchase', ?, ?, ?, ?)
        `).run(payment.supplierId, payment.amount, newBalance, payment.purchaseInvoiceId, 'Supplier payment', payment.userId, now);
      }

      logAudit(payment.userId as number, 'supplier_payment', 'supplier', payment.supplierId as number, `Payment ${payment.amount} to supplier`);
    });

    payTx();
    return true;
  });
}

function generateInvoiceNumber(db: ReturnType<typeof getDb>, prefix: string): string {
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(invoice_number, LENGTH(?) + 1) AS INTEGER)) as max FROM purchase_invoices WHERE invoice_number LIKE ?").get(`${prefix}-`, `${prefix}-%`) as { max: number | null };
  const next = (max.max || 0) + 1;
  return `${prefix}-${next.toString().padStart(6, '0')}`;
}

function createJournalEntriesForPurchase(
  db: ReturnType<typeof getDb>,
  invoiceId: number,
  supplierId: number,
  total: number,
  paid: number,
  remaining: number,
  date: string,
  userId: number
): void {
  const now = getLocalTimestamp();
  const entryNumber = `JE-PURCHASE-${Date.now()}-${invoiceId}`;

  const result = db.prepare(`
    INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, created_by, created_at)
    VALUES (?, ?, ?, 'purchase', ?, ?, ?)
  `).run(entryNumber, date, `Purchase invoice #${invoiceId}`, invoiceId, userId, now);

  const entryId = result.lastInsertRowid as number;
  const insertLine = db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');

  const inventoryAccount = db.prepare("SELECT id FROM accounts WHERE code = '1030'").get() as { id: number } | undefined;
  const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get() as { id: number } | undefined;
  const payableAccount = db.prepare("SELECT id FROM accounts WHERE code = '2000'").get() as { id: number } | undefined;

  if (inventoryAccount) {
    insertLine.run(entryId, inventoryAccount.id, total, 0, 'Inventory increase');
  }
  if (paid > 0 && cashAccount) {
    insertLine.run(entryId, cashAccount.id, 0, paid, 'Cash payment');
  }
  if (remaining > 0 && payableAccount) {
    insertLine.run(entryId, payableAccount.id, 0, remaining, 'Supplier payable');
  }
}
