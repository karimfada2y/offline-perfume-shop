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

function escapeLike(str: string): string {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', async (_event, filters?: { category?: number; brand?: number; active?: boolean; search?: string; productType?: string; includeVariants?: boolean }) => {
    const db = getDb();
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: unknown[] = [];

    if (!filters?.includeVariants) {
      query += ' AND parent_product_id IS NULL';
    }

    if (filters?.category) {
      query += ' AND category_id = ?';
      params.push(filters.category);
    }
    if (filters?.brand) {
      query += ' AND brand_id = ?';
      params.push(filters.brand);
    }
    if (filters?.active !== undefined) {
      query += ' AND active = ?';
      params.push(filters.active ? 1 : 0);
    }
    if (filters?.productType) {
      query += ' AND product_type = ?';
      params.push(filters.productType);
    }
    if (filters?.search) {
      query += ' AND (name_ar LIKE ? ESCAPE \'\\\' OR name_en LIKE ? ESCAPE \'\\\' OR sku LIKE ? ESCAPE \'\\\' OR barcode LIKE ? ESCAPE \'\\\' OR item_code LIKE ? ESCAPE \'\\\' OR item_code_2 LIKE ? ESCAPE \'\\\')';
      const s = `%${escapeLike(filters.search)}%`;
      params.push(s, s, s, s, s, s);
    }

    query += ' ORDER BY name_ar';
    const products = db.prepare(query).all(...params).map(toCamel);

    if (!filters?.includeVariants) {
      for (const product of products) {
        const variants = db.prepare('SELECT * FROM products WHERE parent_product_id = ? AND active = 1 ORDER BY size ASC, name_ar ASC').all(product.id).map(toCamel);
        if (variants.length > 0) {
          product.variants = variants;
        }
      }
    }

    return products;
  });

  ipcMain.handle('products:getById', async (_event, id: number) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return row ? toCamel(row as Record<string, unknown>) : null;
  });

  ipcMain.handle('products:search', async (_event, query: string) => {
    const db = getDb();
    const s = `%${escapeLike(query)}%`;
    return db.prepare(`
      SELECT * FROM products
      WHERE active = 1 AND (name_ar LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\' OR item_code LIKE ? ESCAPE '\\' OR item_code_2 LIKE ? ESCAPE '\\')
      ORDER BY name_ar LIMIT 50
    `).all(s, s, s, s, s, s).map(toCamel);
  });

  ipcMain.handle('products:create', async (_event, product: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const sku = (product.sku as string) || generateSKU(db);

    const result = db.prepare(`
      INSERT INTO products (sku, barcode, item_code, item_code_2, name_ar, name_en, description, category_id, brand_id, unit, size, size_unit, cost, weighted_avg_cost, retail_price, wholesale_price, minimum_price, minimum_stock, current_stock, product_type, sellable, purchasable, consumable, producible, inventory_tracked, inventory_tracking_mode, parent_product_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sku, product.barcode || null, product.itemCode || null, product.itemCode2 || null,
      product.nameAr, product.nameEn, product.description || null,
      product.categoryId || null, product.brandId || null, product.unit || 'piece', product.size || null, product.sizeUnit || null,
      product.cost || 0, product.cost || 0, product.retailPrice || 0, product.wholesalePrice || 0,
      product.minimumPrice || 0, product.minimumStock || 0, product.currentStock || 0,
      product.productType || 'finished_perfume',
      product.sellable !== false ? 1 : 0, product.purchasable !== false ? 1 : 0,
      product.consumable ? 1 : 0, product.producible !== false ? 1 : 0,
      product.inventoryTracked !== false ? 1 : 0,
      product.inventoryTrackingMode || 'finished_stock',
      product.parentProductId || null,
      product.active !== false ? 1 : 0,
      now, now
    );

    const productId = result.lastInsertRowid as number;

    if ((product.currentStock as number) && (product.currentStock as number) > 0) {
      db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reference_type, reason, created_at)
        VALUES (?, 'OPENING_BALANCE', ?, 0, ?, 'product', 'رصيد افتتاحي', ?)
      `).run(productId, product.currentStock, product.currentStock, now);
    }

    logAudit(null, 'product_created', 'product', productId, `Product ${product.nameAr} created`);
    return productId;
  });

  ipcMain.handle('products:update', async (_event, id: number, product: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    db.prepare(`
      UPDATE products SET barcode = ?, item_code = ?, item_code_2 = ?, name_ar = ?, name_en = ?, description = ?, category_id = ?, brand_id = ?,
      unit = ?, size = ?, size_unit = ?, cost = ?, retail_price = ?, wholesale_price = ?,
      minimum_price = ?, minimum_stock = ?, product_type = ?, sellable = ?, purchasable = ?,
      consumable = ?, producible = ?, inventory_tracked = ?, inventory_tracking_mode = ?, parent_product_id = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      product.barcode || null, product.itemCode || null, product.itemCode2 || null,
      product.nameAr, product.nameEn, product.description || null,
      product.categoryId || null, product.brandId || null, product.unit || 'piece', product.size || null, product.sizeUnit || null,
      product.cost || 0, product.retailPrice || 0, product.wholesalePrice || 0,
      product.minimumPrice || 0, product.minimumStock || 0, product.productType || 'finished_perfume',
      product.sellable !== false ? 1 : 0, product.purchasable !== false ? 1 : 0,
      product.consumable ? 1 : 0, product.producible !== false ? 1 : 0,
      product.inventoryTracked !== false ? 1 : 0,
      product.inventoryTrackingMode || 'finished_stock',
      product.parentProductId || null,
      product.active !== false ? 1 : 0, now, id
    );

    logAudit(null, 'product_updated', 'product', id, `Product updated`);
    return true;
  });

  ipcMain.handle('products:delete', async (_event, id: number) => {
    const db = getDb();
    db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(getLocalTimestamp(), id);
    logAudit(null, 'product_deleted', 'product', id, 'Product deactivated');
    return true;
  });

  ipcMain.handle('products:stats', async () => {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND parent_product_id IS NULL').get() as { count: number };
    const byType = db.prepare(`
      SELECT product_type, COUNT(*) as count, COALESCE(SUM(current_stock * weighted_avg_cost), 0) as value
      FROM products WHERE active = 1 AND parent_product_id IS NULL GROUP BY product_type
    `).all();
    const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND parent_product_id IS NULL AND inventory_tracked = 1 AND current_stock <= minimum_stock AND minimum_stock > 0').get() as { count: number };
    const outOfStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND parent_product_id IS NULL AND inventory_tracked = 1 AND current_stock <= 0').get() as { count: number };
    const totalValue = db.prepare('SELECT COALESCE(SUM(current_stock * weighted_avg_cost), 0) as value FROM products WHERE active = 1 AND inventory_tracked = 1').get() as { value: number };
    return { totalProducts: total.count, byType, lowStockCount: lowStock.count, outOfStockCount: outOfStock.count, totalStockValue: totalValue.value };
  });

  ipcMain.handle('products:getVariants', async (_event, parentId: number) => {
    const db = getDb();
    return db.prepare('SELECT * FROM products WHERE parent_product_id = ? ORDER BY size ASC, name_ar ASC').all(parentId).map(toCamel);
  });
}

function generateSKU(db: ReturnType<typeof getDb>): string {
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(sku, 5) AS INTEGER)) as max FROM products WHERE sku LIKE 'PRD-%'").get() as { max: number | null };
  const num = ((max.max || 0) + 1).toString().padStart(6, '0');
  return `PRD-${num}`;
}
