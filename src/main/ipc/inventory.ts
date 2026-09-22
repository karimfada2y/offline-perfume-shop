import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel, toCamelAll } from './toCamel';

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

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:list', async (_event, filters?: { search?: string; categoryId?: number }) => {
    const db = getDb();
    let query = `
      SELECT p.*, c.name_ar as category_name, b.name_ar as brand_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.active = 1 AND p.inventory_tracked = 1
    `;
    const params: unknown[] = [];

    if (filters?.search) {
      query += ' AND (p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    if (filters?.categoryId) {
      query += ' AND p.category_id = ?';
      params.push(filters.categoryId);
    }

    query += ' ORDER BY p.name_ar';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('inventory:movements', async (_event, filters?: { productId?: number; type?: string; from?: string; to?: string }) => {
    const db = getDb();
    let query = `
      SELECT im.*, p.name_ar as product_name, p.sku, u.display_name as user_name
      FROM inventory_movements im
      JOIN products p ON p.id = im.product_id
      LEFT JOIN users u ON u.id = im.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.productId) {
      query += ' AND im.product_id = ?';
      params.push(filters.productId);
    }
    if (filters?.type) {
      query += ' AND im.type = ?';
      params.push(filters.type);
    }
    if (filters?.from) {
      query += ' AND im.created_at >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND im.created_at <= ?';
      params.push(filters.to + 'T23:59:59');
    }

    query += ' ORDER BY im.created_at DESC LIMIT 500';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('inventory:adjust', async (_event, adjustment: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    if (!adjustment.productId) {
      throw new Error('Product ID is required');
    }
    if (!adjustment.quantity || (adjustment.quantity as number) <= 0) {
      throw new Error('Adjustment quantity must be positive');
    }
    if (adjustment.direction !== 'increase' && adjustment.direction !== 'decrease') {
      throw new Error('Direction must be "increase" or "decrease"');
    }

    const adjustTx = db.transaction(() => {
      const product = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(adjustment.productId) as { current_stock: number } | undefined;
      if (!product) {
        throw new Error('Product not found');
      }

      const quantity = adjustment.quantity as number;
      const direction = adjustment.direction as string;
      const adjustAmount = direction === 'increase' ? quantity : -quantity;
      const newStock = product.current_stock + adjustAmount;

      if (newStock < 0) {
        throw new Error('Stock cannot go below zero');
      }

      db.prepare('UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, adjustment.productId);

      db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reason, reference_type, created_by, created_at)
        VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, 'adjustment', ?, ?)
      `).run(adjustment.productId, adjustAmount, product.current_stock, newStock, adjustment.reason || 'Manual adjustment', adjustment.userId, now);

      logAudit(adjustment.userId as number, 'inventory_adjusted', 'product', adjustment.productId as number, `Adjustment: ${direction} ${quantity} - Reason: ${adjustment.reason || 'Manual adjustment'}`);
    });

    adjustTx();
    return true;
  });

  ipcMain.handle('inventory:lowStock', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, c.name_ar as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.active = 1 AND p.inventory_tracked = 1 AND p.current_stock <= p.minimum_stock AND p.minimum_stock > 0
      ORDER BY p.current_stock ASC
    `).all().map(toCamel);
  });
}
