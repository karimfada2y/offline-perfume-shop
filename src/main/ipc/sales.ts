import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { toCamel, toCamelAll } from './toCamel';
import { convertUnit } from '../utils/units';
import { roundMoney } from '../utils/money';

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

const VOLUME_UNITS = new Set(['ml', 'l', 'liter', 'liters']);
const WEIGHT_UNITS = new Set(['g', 'kg', 'gram', 'grams']);

function getUnitDimension(unit: string): 'volume' | 'weight' | 'other' {
  const u = unit.toLowerCase();
  if (VOLUME_UNITS.has(u)) return 'volume';
  if (WEIGHT_UNITS.has(u)) return 'weight';
  return 'other';
}

export interface RecipeComponentData {
  rawMaterialId: number;
  productId: number;
  quantity: number;
  unit: string;
  nameAr: string;
  weightedAvgCost: number;
  currentStock: number;
}

export interface RecipeConsumptionData {
  productId: number;
  saleQuantity: number;
  formulaId: number;
  formulaName: string;
  components: RecipeComponentData[];
}

export function loadRecipeForProduct(
  db: ReturnType<typeof getDb>,
  productId: number
): { formula: Record<string, unknown>; components: Array<Record<string, unknown>> } | null {
  const formula = db.prepare(`
    SELECT f.* FROM formulas f
    WHERE f.target_product_id = ? AND f.active = 1
    ORDER BY f.id DESC LIMIT 1
  `).get(productId) as Record<string, unknown> | undefined;

  if (!formula) return null;

  const components = db.prepare(`
    SELECT fc.*, rm.product_id as component_product_id, p.name_ar, p.unit as product_unit,
           p.weighted_avg_cost, p.current_stock
    FROM formula_components fc
    JOIN raw_materials rm ON rm.id = fc.raw_material_id
    JOIN products p ON p.id = rm.product_id
    WHERE fc.formula_id = ?
    ORDER BY fc.sort_order
  `).all(formula.id) as Array<Record<string, unknown>>;

  return { formula, components };
}

export function calculateRecipeConsumption(
  db: ReturnType<typeof getDb>,
  items: Array<Record<string, unknown>>
): RecipeConsumptionData[] {
  const consumptions: RecipeConsumptionData[] = [];

  for (const item of items) {
    const productId = item.productId as number;
    const saleQty = item.quantity as number;

    const product = db.prepare('SELECT inventory_tracking_mode, size, size_unit FROM products WHERE id = ?').get(productId) as { inventory_tracking_mode: string; size: number | null; size_unit: string | null } | undefined;
    if (!product || product.inventory_tracking_mode !== 'recipe_consumption') continue;

    const recipe = loadRecipeForProduct(db, productId);
    if (!recipe) {
      const prod = db.prepare('SELECT name_ar FROM products WHERE id = ?').get(productId) as { name_ar: string } | undefined;
      throw new Error(`No active recipe found for product "${prod?.name_ar || productId}". Cannot sell recipe_consumption product without a formula.`);
    }

    const batchSize = recipe.formula.batch_size as number;
    if (!batchSize || batchSize <= 0) continue;

    const formulaUnit = (recipe.formula.batch_unit as string) || 'ml';
    const productSize = product.size || 1;
    const productSizeUnit = product.size_unit || formulaUnit;
    const totalQuantityInBatchUnit = saleQty * convertUnit(productSize, productSizeUnit, formulaUnit);
    const scaleFactor = totalQuantityInBatchUnit / batchSize;

    const components: RecipeComponentData[] = recipe.components.map(comp => {
      const rawQty = (comp.quantity as number) * scaleFactor;
      const productUnit = (comp.product_unit as string) || 'ml';
      const fromDim = getUnitDimension(formulaUnit);
      const toDim = getUnitDimension(productUnit);
      if (fromDim !== toDim && fromDim !== 'other' && toDim !== 'other') {
        throw new Error(`Cannot convert between ${formulaUnit} and ${productUnit} for ${comp.name_ar}`);
      }
      const requiredQty = convertUnit(rawQty, formulaUnit, productUnit);
      return {
        rawMaterialId: comp.raw_material_id as number,
        productId: comp.component_product_id as number,
        quantity: requiredQty,
        unit: productUnit,
        nameAr: comp.name_ar as string,
        weightedAvgCost: comp.weighted_avg_cost as number,
        currentStock: comp.current_stock as number,
      };
    });

    consumptions.push({
      productId,
      saleQuantity: saleQty,
      formulaId: recipe.formula.id as number,
      formulaName: recipe.formula.name_ar as string,
      components,
    });
  }

  return consumptions;
}

export function aggregateRecipeComponents(consumptions: RecipeConsumptionData[]): Map<number, { productId: number; nameAr: string; totalQuantity: number; unit: string; unitCost: number; currentStock: number }> {
  const aggregated = new Map<number, { productId: number; nameAr: string; totalQuantity: number; unit: string; unitCost: number; currentStock: number }>();

  for (const consumption of consumptions) {
    for (const comp of consumption.components) {
      const existing = aggregated.get(comp.productId);
      if (existing) {
        if (existing.unit !== comp.unit) {
          throw new Error(`Unit mismatch for ${comp.nameAr}: ${existing.unit} vs ${comp.unit}`);
        }
        existing.totalQuantity += comp.quantity;
      } else {
        aggregated.set(comp.productId, {
          productId: comp.productId,
          nameAr: comp.nameAr,
          totalQuantity: comp.quantity,
          unit: comp.unit,
          unitCost: comp.weightedAvgCost,
          currentStock: comp.currentStock,
        });
      }
    }
  }

  return aggregated;
}

export function registerSaleHandlers(): void {
  ipcMain.handle('sales:list', async (_event, filters?: { from?: string; to?: string; customerId?: number; userId?: number }) => {
    const db = getDb();
    let query = `
      SELECT s.*, c.name_ar as customer_name, u.display_name as user_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.from) {
      query += ' AND s.date >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND s.date <= ?';
      params.push(filters.to);
    }
    if (filters?.customerId) {
      query += ' AND s.customer_id = ?';
      params.push(filters.customerId);
    }
    if (filters?.userId) {
      query += ' AND s.user_id = ?';
      params.push(filters.userId);
    }

    query += ' ORDER BY s.created_at DESC';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('sales:getById', async (_event, id: number) => {
    const db = getDb();
    const sale = db.prepare(`
      SELECT s.*, c.name_ar as customer_name, u.display_name as user_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(id);

    if (!sale) return null;

    const items = db.prepare(`
      SELECT si.*, p.name_ar as product_name, p.name_en as product_name_en,
             p.unit as product_unit, p.size as product_size, p.size_unit as product_size_unit
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
    `).all(id).map(toCamel);

    const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id).map(toCamel);

    return { ...toCamel(sale as Record<string, unknown>), items, payments };
  });

  ipcMain.handle('sales:create', async (_event, sale: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const today = getLocalDate();

    const items = sale.items as Array<Record<string, unknown>>;
    if (!items || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || (item.quantity as number) <= 0) {
        throw new Error(`Invalid item: missing productId or quantity <= 0`);
      }
      if (!item.unitPrice || (item.unitPrice as number) < 0) {
        throw new Error(`Invalid item: unitPrice must be >= 0`);
      }
    }

    const subtotal = roundMoney(items.reduce((sum, item) => sum + ((item.quantity as number) * (item.unitPrice as number)), 0));
    const discount = roundMoney((sale.discount as number) || 0);
    const taxRate = (sale.taxRate as number) || 0;
    const taxAmount = roundMoney(((subtotal - discount) * taxRate) / 100);
    const total = roundMoney(subtotal - discount + taxAmount);
    const paid = roundMoney((sale.paid as number) || 0);

    if (paid > total) {
      throw new Error(`Payment (${paid}) cannot exceed total (${total})`);
    }

    const remaining = roundMoney(total - paid);
    const invoiceNumber = generateSaleInvoiceNumber(db);

    const recipeConsumptions = calculateRecipeConsumption(db, items);
    const recipeAggregated = aggregateRecipeComponents(recipeConsumptions);

    const createSale = db.transaction(() => {
      for (const item of items) {
        const product = db.prepare('SELECT current_stock, unit, inventory_tracking_mode FROM products WHERE id = ?').get(item.productId as number) as { current_stock: number; unit: string; inventory_tracking_mode: string } | undefined;
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        if (product.inventory_tracking_mode === 'recipe_consumption') {
          continue;
        }
        if (product.current_stock < (item.quantity as number)) {
          throw new Error(`Insufficient stock for product ${item.productId}: has ${product.current_stock}, need ${item.quantity}`);
        }
      }

      if (recipeAggregated.size > 0) {
        for (const [componentProductId, comp] of recipeAggregated) {
          const currentProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(componentProductId) as { current_stock: number } | undefined;
          if (!currentProduct) {
            throw new Error(`Component product not found: ${componentProductId} (${comp.nameAr})`);
          }
          if (currentProduct.current_stock < comp.totalQuantity) {
            const deficit = comp.totalQuantity - currentProduct.current_stock;
            throw new Error(
              `Cannot complete sale\n\nInsufficient stock:\n\n${comp.nameAr}\n  Available: ${currentProduct.current_stock.toFixed(2)} ${comp.unit}\n  Required: ${comp.totalQuantity.toFixed(2)} ${comp.unit}\n  Deficit: ${deficit.toFixed(2)} ${comp.unit}`
            );
          }
        }
      }

      const result = db.prepare(`
        INSERT INTO sales (invoice_number, customer_id, user_id, date, subtotal, discount, tax_rate, tax_amount, total, paid, remaining, payment_status, payment_method, cash_session_id, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber, sale.customerId ?? null, sale.userId ?? null,
        sale.date || today, subtotal, discount, taxRate, taxAmount, total, paid, remaining,
        remaining <= 0 ? 'paid' : remaining < total ? 'partial' : 'unpaid',
        sale.paymentMethod || 'cash', sale.cashSessionId ?? null, sale.notes ?? null, now
      );

      const saleId = result.lastInsertRowid as number;

      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, cost, discount, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reference_type, reference_id, created_by, created_at)
        VALUES (?, 'SALE', ?, ?, ?, 'sale', ?, ?, ?)
      `);

      const insertRecipeMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, unit_cost, total_cost, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, 'SALE_RECIPE_CONSUMPTION', ?, ?, ?, ?, ?, 'sale', ?, ?, ?, ?)
      `);

      const updateStock = db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?');

      let totalRecipeCost = 0;

      for (const item of items) {
        const product = db.prepare('SELECT current_stock, inventory_tracking_mode FROM products WHERE id = ?').get(item.productId as number) as { current_stock: number; inventory_tracking_mode: string };
        const itemTotal = roundMoney(((item.quantity as number) * (item.unitPrice as number)) - ((item.discount as number) || 0));

        let itemCost = 0;
        if (product.inventory_tracking_mode === 'recipe_consumption') {
          const consumption = recipeConsumptions.find(c => c.productId === (item.productId as number));
          if (consumption) {
            itemCost = consumption.components.reduce((sum, comp) => sum + comp.quantity * comp.weightedAvgCost, 0) / (item.quantity as number);
          }
        } else {
          itemCost = (item.cost as number) || 0;
        }

        insertItem.run(saleId, item.productId, item.nameAr || item.productName || null, item.quantity, item.unitPrice, itemCost, item.discount || 0, itemTotal);

        if (product.inventory_tracking_mode === 'recipe_consumption') {
          continue;
        }

        const newStock = product.current_stock - (item.quantity as number);
        updateStock.run(item.quantity, now, item.productId);
        insertMovement.run(item.productId, item.quantity, product.current_stock, newStock, saleId, sale.userId ?? null, now);
      }

      if (recipeConsumptions.length > 0) {
        for (const consumption of recipeConsumptions) {
          for (const comp of consumption.components) {
            const compProduct = db.prepare('SELECT current_stock, weighted_avg_cost FROM products WHERE id = ?').get(comp.productId) as { current_stock: number; weighted_avg_cost: number };
            const beforeStock = compProduct.current_stock;
            updateStock.run(comp.quantity, now, comp.productId);
            const afterStock = beforeStock - comp.quantity;
            const unitCost = comp.weightedAvgCost;
            const totalCost = comp.quantity * unitCost;
            totalRecipeCost += totalCost;
            insertRecipeMovement.run(
              comp.productId, -comp.quantity, beforeStock, afterStock,
              unitCost, totalCost, saleId, `Sale ${invoiceNumber} - ${consumption.formulaName}`,
              sale.userId ?? null, now
            );
          }
        }
      }

      if (sale.customerId && remaining > 0) {
        const customer = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(sale.customerId as number) as { current_balance: number };
        const newBalance = customer.current_balance + remaining;
        db.prepare('UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, sale.customerId);

        db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference_type, reference_id, description, created_by, created_at)
          VALUES (?, 'CREDIT_SALE', ?, ?, 'sale', ?, ?, ?, ?)
        `).run(sale.customerId, remaining, newBalance, saleId, `Sale ${invoiceNumber}`, sale.userId ?? null, now);
      }

      if (paid > 0 && sale.cashSessionId) {
        db.prepare(`
          INSERT INTO cash_movements (session_id, type, amount, description, reference_type, reference_id, created_by, created_at)
          VALUES (?, 'SALE', ?, ?, 'sale', ?, ?, ?)
        `).run(sale.cashSessionId, paid, `Sale ${invoiceNumber}`, saleId, sale.userId ?? null, now);
      }

      if (paid > 0) {
        db.prepare(`
          INSERT INTO sale_payments (sale_id, amount, payment_method, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(saleId, paid, sale.paymentMethod || 'cash', sale.notes ?? null, sale.userId ?? null, now);
      }

      createJournalEntriesForSale(db, saleId, sale.customerId as number | null, total, paid, remaining, sale.date as string || today, sale.userId as number);

      logAudit(sale.userId as number, 'sale_created', 'sale', saleId, `Sale ${invoiceNumber} created - Total: ${total}`);
      const receiptItems = items.map((item: Record<string, unknown>) => ({
        name: item.nameAr || item.productName || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total: roundMoney(((item.quantity as number) * (item.unitPrice as number)) - ((item.discount as number) || 0)),
        unit: item.unit || 'piece',
        size: item.size || null,
        sizeUnit: item.sizeUnit || null,
      }));
      return { id: saleId, invoiceNumber, total, paid, remaining, discount, subtotal, items: receiptItems, change: paid > total ? paid - total : 0, paymentMethod: sale.paymentMethod || 'cash' };
    });

    return createSale();
  });

  ipcMain.handle('sales:returnItem', async (_event, returnData: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const today = getLocalDate();

    const returnTx = db.transaction(() => {
      const items = returnData.items as Array<Record<string, unknown>>;
      if (!items || items.length === 0) {
        throw new Error('Return must have at least one item');
      }

      for (const item of items) {
        if (!item.productId || !item.quantity || (item.quantity as number) <= 0) {
          throw new Error(`Invalid return item: missing productId or quantity <= 0`);
        }
        if (item.saleItemId) {
          const saleItem = db.prepare('SELECT quantity FROM sale_items WHERE id = ?').get(item.saleItemId) as { quantity: number } | undefined;
          if (saleItem && (item.quantity as number) > saleItem.quantity) {
            throw new Error(`Return quantity (${item.quantity}) cannot exceed original sale quantity (${saleItem.quantity})`);
          }
        }
      }

      const subtotal = roundMoney(items.reduce((sum, item) => sum + ((item.quantity as number) * (item.unitPrice as number)), 0));
      const refundAmount = roundMoney((returnData.refundAmount as number) || subtotal);

      if (refundAmount > subtotal) {
        throw new Error(`Refund amount (${refundAmount}) cannot exceed return subtotal (${subtotal})`);
      }

      const returnNumber = generateReturnNumber(db);

      const result = db.prepare(`
        INSERT INTO sale_returns (return_number, original_sale_id, customer_id, user_id, date, subtotal, total, refund_amount, refund_method, reason, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        returnNumber, returnData.originalSaleId, returnData.customerId || null,
        returnData.userId, returnData.date || today,
        subtotal, subtotal, refundAmount,
        returnData.refundMethod || 'cash', returnData.reason, returnData.notes, now
      );

      const returnId = result.lastInsertRowid as number;

      const insertItem = db.prepare(`
        INSERT INTO sale_return_items (sale_return_id, sale_item_id, product_id, product_name, quantity, unit_price, cost, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reference_type, reference_id, created_by, created_at)
        VALUES (?, 'SALE_RETURN', ?, ?, ?, 'sale_return', ?, ?, ?)
      `);

      const insertRecipeReturnMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, unit_cost, total_cost, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, 'RETURN_RECIPE_REVERSAL', ?, ?, ?, ?, ?, 'sale_return', ?, ?, ?, ?)
      `);

      const updateStock = db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?');

      for (const item of items) {
        const product = db.prepare('SELECT current_stock, inventory_tracking_mode, size, size_unit FROM products WHERE id = ?').get(item.productId as number) as { current_stock: number; inventory_tracking_mode: string; size: number | null; size_unit: string | null } | undefined;
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        let itemCost = (item.cost as number) || 0;
        if (item.saleItemId) {
          const saleItem = db.prepare('SELECT cost FROM sale_items WHERE id = ?').get(item.saleItemId) as { cost: number } | undefined;
          if (saleItem) itemCost = saleItem.cost;
        }

        insertItem.run(returnId, item.saleItemId || null, item.productId, item.productName, item.quantity, item.unitPrice, itemCost, (item.quantity as number) * (item.unitPrice as number));

        if (product.inventory_tracking_mode === 'recipe_consumption') {
          const recipe = loadRecipeForProduct(db, item.productId as number);
          if (recipe) {
            const batchSize = recipe.formula.batch_size as number;
            if (batchSize && batchSize > 0) {
              const formulaUnit = (recipe.formula.batch_unit as string) || 'ml';
              const productSize = product.size || 1;
              const productSizeUnit = product.size_unit || formulaUnit;
              const totalQuantityInBatchUnit = (item.quantity as number) * convertUnit(productSize, productSizeUnit, formulaUnit);
              const scaleFactor = totalQuantityInBatchUnit / batchSize;
              for (const comp of recipe.components) {
                const rawQty = (comp.quantity as number) * scaleFactor;
                const productUnit = (comp.product_unit as string) || 'ml';
                const requiredQty = convertUnit(rawQty, formulaUnit, productUnit);
                const componentProductId = comp.component_product_id as number;
                const compProduct = db.prepare('SELECT current_stock, weighted_avg_cost FROM products WHERE id = ?').get(componentProductId) as { current_stock: number; weighted_avg_cost: number };
                const beforeStock = compProduct.current_stock;
                db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?').run(requiredQty, now, componentProductId);
                const afterStock = beforeStock + requiredQty;
                const unitCost = comp.weighted_avg_cost as number;
                insertRecipeReturnMovement.run(
                  componentProductId, requiredQty, beforeStock, afterStock,
                  unitCost, requiredQty * unitCost, returnId, `Return ${returnNumber} - recipe reversal`,
                  returnData.userId, now
                );
              }
            }
          }
          continue;
        }

        const newStock = product.current_stock + (item.quantity as number);
        updateStock.run(item.quantity, now, item.productId);
        insertMovement.run(item.productId, item.quantity, product.current_stock, newStock, returnId, returnData.userId, now);
      }

      if (returnData.customerId && refundAmount > 0) {
        const customer = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(returnData.customerId as number) as { current_balance: number };
        const newBalance = customer.current_balance - refundAmount;
        db.prepare('UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, returnData.customerId);

        db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference_type, reference_id, description, created_by, created_at)
          VALUES (?, 'REFUND', ?, ?, 'sale_return', ?, ?, ?, ?)
        `).run(returnData.customerId, refundAmount, newBalance, returnId, `Return ${returnNumber}`, returnData.userId, now);
      }

      if (returnData.refundMethod === 'cash' && returnData.cashSessionId && refundAmount > 0) {
        db.prepare(`
          INSERT INTO cash_movements (session_id, type, amount, description, reference_type, reference_id, created_by, created_at)
          VALUES (?, 'REFUND', ?, ?, 'sale_return', ?, ?, ?)
        `).run(returnData.cashSessionId, refundAmount, `Return ${returnNumber}`, returnId, returnData.userId, now);
      }

      const originalSale = db.prepare('SELECT total, paid FROM sales WHERE id = ?').get(returnData.originalSaleId) as { total: number; paid: number } | undefined;
      if (originalSale) {
        let cogs = 0;
        for (const item of items) {
          if (item.saleItemId) {
            const saleItem = db.prepare('SELECT cost FROM sale_items WHERE id = ?').get(item.saleItemId) as { cost: number } | undefined;
            cogs += (saleItem ? saleItem.cost : 0) * (item.quantity as number);
          }
        }
        cogs = roundMoney(cogs);
        createJournalEntriesForReturn(db, returnId, returnData.originalSaleId as number, refundAmount, cogs, returnData.date as string || today, returnData.userId as number, returnData.refundMethod as string);
      }

      logAudit(returnData.userId as number, 'sale_return', 'sale_return', returnId, `Return ${returnNumber} created`);
      return returnId;
    });

    return returnTx();
  });

  ipcMain.handle('sales:receivePayment', async (_event, payment: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const payTx = db.transaction(() => {
      const sale = db.prepare('SELECT remaining FROM sales WHERE id = ?').get(payment.saleId) as { remaining: number } | undefined;
      if (!sale) {
        throw new Error(`Sale not found: ${payment.saleId}`);
      }
      if ((payment.amount as number) <= 0) {
        throw new Error('Payment amount must be positive');
      }
      if ((payment.amount as number) > sale.remaining) {
        throw new Error(`Payment (${payment.amount}) cannot exceed remaining balance (${sale.remaining})`);
      }

      const newRemaining = sale.remaining - (payment.amount as number);

      db.prepare('UPDATE sales SET paid = paid + ?, remaining = ?, payment_status = ?, payment_method = ? WHERE id = ?').run(
        payment.amount, newRemaining, newRemaining <= 0 ? 'paid' : 'partial', payment.paymentMethod || 'cash', payment.saleId
      );

      if (payment.customerId) {
        const customer = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(payment.customerId) as { current_balance: number };
        const newBalance = customer.current_balance - (payment.amount as number);
        db.prepare('UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, payment.customerId);

        db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference_type, reference_id, description, created_by, created_at)
          VALUES (?, 'PAYMENT', ?, ?, 'sale', ?, ?, ?, ?)
        `).run(payment.customerId, payment.amount, newBalance, payment.saleId, 'Customer payment', payment.userId, now);
      }

      if (payment.cashSessionId && (payment.amount as number) > 0) {
        db.prepare(`
          INSERT INTO cash_movements (session_id, type, amount, description, reference_type, reference_id, created_by, created_at)
          VALUES (?, 'PAYMENT', ?, ?, 'sale', ?, ?, ?)
        `).run(payment.cashSessionId, payment.amount, 'Customer payment', payment.saleId, payment.userId, now);
      }

      db.prepare(`
        INSERT INTO sale_payments (sale_id, amount, payment_method, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(payment.saleId, payment.amount, payment.paymentMethod || 'cash', 'Customer payment', payment.userId, now);

      logAudit(payment.userId as number, 'customer_payment', 'sale', payment.saleId as number, `Payment ${payment.amount} received`);
    });

    payTx();
    return true;
  });

  ipcMain.handle('sales:previewRecipe', async (_event, items: Array<{ productId: number; quantity: number }>) => {
    const db = getDb();
    const dbItems = items.map(i => ({ productId: i.productId, quantity: i.quantity }));
    const consumptions = calculateRecipeConsumption(db, dbItems as Array<Record<string, unknown>>);
    const aggregated = aggregateRecipeComponents(consumptions);
    const result: Array<{ productId: number; nameAr: string; totalQuantity: number; unit: string; currentStock: number; sufficient: boolean }> = [];
    for (const [, comp] of aggregated) {
      result.push({
        productId: comp.productId,
        nameAr: comp.nameAr,
        totalQuantity: comp.totalQuantity,
        unit: comp.unit,
        currentStock: comp.currentStock,
        sufficient: comp.currentStock >= comp.totalQuantity,
      });
    }
    return result;
  });
}

function generateSaleInvoiceNumber(db: ReturnType<typeof getDb>): string {
  const today = getLocalDate().replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) as count FROM sales WHERE invoice_number LIKE ?").get(`SL-${today}-%`) as { count: number };
  return `SL-${today}-${(count.count + 1).toString().padStart(4, '0')}`;
}

function generateReturnNumber(db: ReturnType<typeof getDb>): string {
  const today = getLocalDate().replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) as count FROM sale_returns WHERE return_number LIKE ?").get(`RT-${today}-%`) as { count: number };
  return `RT-${today}-${(count.count + 1).toString().padStart(4, '0')}`;
}

function createJournalEntriesForSale(
  db: ReturnType<typeof getDb>,
  saleId: number,
  customerId: number | null,
  total: number,
  paid: number,
  remaining: number,
  date: string,
  userId: number
): void {
  const now = getLocalTimestamp();
  const entryNumber = `JE-SALE-${Date.now()}-${saleId}`;

  const items = db.prepare('SELECT cost, quantity FROM sale_items WHERE sale_id = ?').all(saleId) as Array<{ cost: number; quantity: number }>;
  const cogs = roundMoney(items.reduce((sum, item) => sum + item.cost * item.quantity, 0));

  const result = db.prepare(`
    INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, created_by, created_at)
    VALUES (?, ?, ?, 'sale', ?, ?, ?)
  `).run(entryNumber, date, `Sale invoice #${saleId}`, saleId, userId, now);

  const entryId = result.lastInsertRowid as number;
  const insertLine = db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');

  const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get() as { id: number } | undefined;
  const receivableAccount = db.prepare("SELECT id FROM accounts WHERE code = '1020'").get() as { id: number } | undefined;
  const revenueAccount = db.prepare("SELECT id FROM accounts WHERE code = '4000'").get() as { id: number } | undefined;
  const cogsAccount = db.prepare("SELECT id FROM accounts WHERE code = '5000'").get() as { id: number } | undefined;
  const inventoryAccount = db.prepare("SELECT id FROM accounts WHERE code = '1030'").get() as { id: number } | undefined;

  if (paid > 0 && cashAccount) {
    insertLine.run(entryId, cashAccount.id, paid, 0, 'Cash received');
  }
  if (remaining > 0 && receivableAccount) {
    insertLine.run(entryId, receivableAccount.id, remaining, 0, 'Customer receivable');
  }
  if (revenueAccount) {
    insertLine.run(entryId, revenueAccount.id, 0, total, 'Sales revenue');
  }

  if (cogs > 0 && cogsAccount && inventoryAccount) {
    insertLine.run(entryId, cogsAccount.id, cogs, 0, 'Cost of goods sold');
    insertLine.run(entryId, inventoryAccount.id, 0, cogs, 'Inventory reduction');
  }
}

function createJournalEntriesForReturn(
  db: ReturnType<typeof getDb>,
  returnId: number,
  originalSaleId: number,
  refundAmount: number,
  cogs: number,
  date: string,
  userId: number,
  refundMethod?: string
): void {
  const now = getLocalTimestamp();
  const entryNumber = `JE-RETURN-${Date.now()}-${returnId}`;

  const result = db.prepare(`
    INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, created_by, created_at)
    VALUES (?, ?, ?, 'sale_return', ?, ?, ?)
  `).run(entryNumber, date, `Return for sale #${originalSaleId}`, returnId, userId, now);

  const entryId = result.lastInsertRowid as number;
  const insertLine = db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');

  const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get() as { id: number } | undefined;
  const receivableAccount = db.prepare("SELECT id FROM accounts WHERE code = '1020'").get() as { id: number } | undefined;
  const revenueAccount = db.prepare("SELECT id FROM accounts WHERE code = '4000'").get() as { id: number } | undefined;
  const cogsAccount = db.prepare("SELECT id FROM accounts WHERE code = '5000'").get() as { id: number } | undefined;
  const inventoryAccount = db.prepare("SELECT id FROM accounts WHERE code = '1030'").get() as { id: number } | undefined;

  if (revenueAccount && refundAmount > 0) {
    insertLine.run(entryId, revenueAccount.id, refundAmount, 0, 'Sales return (revenue reversal)');
  }

  if (cogsAccount && inventoryAccount && cogs > 0) {
    insertLine.run(entryId, cogsAccount.id, 0, cogs, 'COGS reversal');
    insertLine.run(entryId, inventoryAccount.id, cogs, 0, 'Inventory restoration');
  }

  if (refundAmount > 0) {
    if (refundMethod === 'cash' && cashAccount) {
      insertLine.run(entryId, cashAccount.id, 0, refundAmount, 'Cash refund');
    } else if (receivableAccount) {
      insertLine.run(entryId, receivableAccount.id, 0, refundAmount, 'Customer balance credit');
    }
  }
}
