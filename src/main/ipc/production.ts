import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
import { logAudit } from './index';
import { convertUnit } from '../utils/units';
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

const VOLUME_UNITS = new Set(['ml', 'l', 'liter', 'liters']);
const WEIGHT_UNITS = new Set(['g', 'kg', 'gram', 'grams']);

function getUnitDimension(unit: string): 'volume' | 'weight' | 'other' {
  const u = unit.toLowerCase();
  if (VOLUME_UNITS.has(u)) return 'volume';
  if (WEIGHT_UNITS.has(u)) return 'weight';
  return 'other';
}

export function registerProductionHandlers(): void {
  ipcMain.handle('production:listRawMaterials', async (_event, filters?: { type?: string }) => {
    const db = getDb();
    let query = `
      SELECT rm.*, p.name_ar, p.name_en, p.sku, p.item_code, p.current_stock, p.cost, p.weighted_avg_cost, p.unit as product_unit, p.product_type
      FROM raw_materials rm
      JOIN products p ON p.id = rm.product_id
      WHERE rm.active = 1 AND p.active = 1
    `;
    const params: unknown[] = [];
    if (filters?.type) {
      query += ' AND p.product_type = ?';
      params.push(filters.type);
    }
    query += ' ORDER BY p.name_ar';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('production:createRawMaterial', async (_event, material: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();
    const existing = db.prepare('SELECT id FROM raw_materials WHERE product_id = ?').get(material.productId) as { id: number } | undefined;
    if (existing) throw new Error('This product is already a raw material');
    const result = db.prepare('INSERT INTO raw_materials (product_id, unit, created_at) VALUES (?, ?, ?)').run(
      material.productId, material.unit || 'ml', now
    );
    logAudit(null, 'raw_material_created', 'raw_material', result.lastInsertRowid as number, 'Raw material created');
    return result.lastInsertRowid;
  });

  ipcMain.handle('production:updateRawMaterial', async (_event, id: number, material: Record<string, unknown>) => {
    const db = getDb();
    db.prepare('UPDATE raw_materials SET unit = ? WHERE id = ?').run(material.unit || 'ml', id);
    return true;
  });

  ipcMain.handle('production:deleteRawMaterial', async (_event, id: number) => {
    const db = getDb();
    db.prepare('UPDATE raw_materials SET active = 0 WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('production:listFormulas', async (_event, filters?: { bottleSize?: number; targetProductType?: string }) => {
    const db = getDb();
    let query = `
      SELECT f.*, p.name_ar as target_product_name, p.name_en as target_product_name_en,
             bp.name_ar as bottle_product_name, bp.name_en as bottle_product_name_en
      FROM formulas f
      LEFT JOIN products p ON p.id = f.target_product_id
      LEFT JOIN products bp ON bp.id = f.bottle_product_id
      WHERE f.active = 1
    `;
    const params: unknown[] = [];
    if (filters?.bottleSize) {
      query += ' AND (f.bottle_size = ? OR f.bottle_size IS NULL)';
      params.push(filters.bottleSize);
    }
    if (filters?.targetProductType) {
      query += ' AND f.target_product_type = ?';
      params.push(filters.targetProductType);
    }
    query += ' ORDER BY f.name_ar';
    const formulas = db.prepare(query).all(...params).map(toCamel) as Array<Record<string, unknown>>;

    for (const formula of formulas) {
      formula.components = db.prepare(`
        SELECT fc.*, rm.product_id as component_product_id, p.name_ar as material_name, p.name_en as material_name_en,
               p.sku as material_sku, p.current_stock as material_stock, p.weighted_avg_cost as material_unit_cost
        FROM formula_components fc
        JOIN raw_materials rm ON rm.id = fc.raw_material_id
        JOIN products p ON p.id = rm.product_id
        WHERE fc.formula_id = ?
        ORDER BY fc.sort_order
      `).all(formula.id).map(toCamel);
    }

    return formulas;
  });

  ipcMain.handle('production:getFormulaById', async (_event, id: number) => {
    const db = getDb();
    const row = db.prepare(`
      SELECT f.*, p.name_ar as target_product_name, bp.name_ar as bottle_product_name
      FROM formulas f
      LEFT JOIN products p ON p.id = f.target_product_id
      LEFT JOIN products bp ON bp.id = f.bottle_product_id
      WHERE f.id = ?
    `).get(id);
    const formula = row ? toCamel(row as Record<string, unknown>) : null;
    if (!formula) return null;
    formula.components = db.prepare(`
      SELECT fc.*, rm.product_id as component_product_id, p.name_ar as material_name, p.sku as material_sku,
             p.current_stock as material_stock, p.weighted_avg_cost as material_unit_cost
      FROM formula_components fc
      JOIN raw_materials rm ON rm.id = fc.raw_material_id
      JOIN products p ON p.id = rm.product_id
      WHERE fc.formula_id = ?
      ORDER BY fc.sort_order
    `).all(id).map(toCamel);
    return formula;
  });

  ipcMain.handle('production:createFormula', async (_event, formula: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const createFormulaTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO formulas (name_ar, name_en, target_product_id, batch_size, batch_unit, bottle_product_id, bottle_size, bottle_size_unit, target_product_type, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        formula.nameAr, formula.nameEn, formula.targetProductId || null,
        formula.batchSize, formula.batchUnit || 'ml',
        formula.bottleProductId || null, formula.bottleSize || null, formula.bottleSizeUnit || 'ml',
        formula.targetProductType || 'finished_perfume', formula.notes, now
      );

      const formulaId = result.lastInsertRowid as number;

      const insertComponent = db.prepare(`
        INSERT INTO formula_components (formula_id, raw_material_id, quantity, percentage, component_type, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const components = formula.components as Array<Record<string, unknown>>;
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        insertComponent.run(formulaId, comp.rawMaterialId, comp.quantity, comp.percentage || null, comp.componentType || 'raw_material', i + 1);
      }

      logAudit(null, 'formula_created', 'formula', formulaId, `Formula ${formula.nameAr} created`);
      return formulaId;
    });

    return createFormulaTx();
  });

  ipcMain.handle('production:updateFormula', async (_event, id: number, formula: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const updateFormulaTx = db.transaction(() => {
      db.prepare(`
        UPDATE formulas SET name_ar = ?, name_en = ?, target_product_id = ?, batch_size = ?, batch_unit = ?,
        bottle_product_id = ?, bottle_size = ?, bottle_size_unit = ?, target_product_type = ?, notes = ?
        WHERE id = ?
      `).run(
        formula.nameAr, formula.nameEn, formula.targetProductId || null,
        formula.batchSize, formula.batchUnit || 'ml',
        formula.bottleProductId || null, formula.bottleSize || null, formula.bottleSizeUnit || 'ml',
        formula.targetProductType || 'finished_perfume', formula.notes, id
      );

      db.prepare('DELETE FROM formula_components WHERE formula_id = ?').run(id);

      const insertComponent = db.prepare(`
        INSERT INTO formula_components (formula_id, raw_material_id, quantity, percentage, component_type, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const components = formula.components as Array<Record<string, unknown>>;
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        insertComponent.run(id, comp.rawMaterialId, comp.quantity, comp.percentage || null, comp.componentType || 'raw_material', i + 1);
      }

      logAudit(null, 'formula_updated', 'formula', id, `Formula updated`);
      return true;
    });

    return updateFormulaTx();
  });

  ipcMain.handle('production:deleteFormula', async (_event, id: number) => {
    const db = getDb();
    db.prepare('UPDATE formulas SET active = 0 WHERE id = ?').run(id);
    logAudit(null, 'formula_deleted', 'formula', id, 'Formula deactivated');
    return true;
  });

  ipcMain.handle('production:listBatches', async (_event, filters?: { from?: string; to?: string; formulaId?: number }) => {
    const db = getDb();
    let query = `
      SELECT pb.*, f.name_ar as formula_name, f.name_en as formula_name_en,
             p.name_ar as product_name, p.name_en as product_name_en,
             bp.name_ar as bottle_product_name,
             u.display_name as user_name
      FROM production_batches pb
      JOIN formulas f ON f.id = pb.formula_id
      LEFT JOIN products p ON p.id = pb.target_product_id
      LEFT JOIN products bp ON bp.id = pb.bottle_product_id
      LEFT JOIN users u ON u.id = pb.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters?.from) { query += ' AND pb.created_at >= ?'; params.push(filters.from); }
    if (filters?.to) { query += ' AND pb.created_at <= ?'; params.push(filters.to + 'T23:59:59'); }
    if (filters?.formulaId) { query += ' AND pb.formula_id = ?'; params.push(filters.formulaId); }
    query += ' ORDER BY pb.created_at DESC';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('production:getBatchById', async (_event, id: number) => {
    const db = getDb();
    const row = db.prepare(`
      SELECT pb.*, f.name_ar as formula_name, p.name_ar as product_name, bp.name_ar as bottle_product_name,
             u.display_name as user_name
      FROM production_batches pb
      JOIN formulas f ON f.id = pb.formula_id
      LEFT JOIN products p ON p.id = pb.target_product_id
      LEFT JOIN products bp ON bp.id = pb.bottle_product_id
      LEFT JOIN users u ON u.id = pb.created_by
      WHERE pb.id = ?
    `).get(id);
    const batch = row ? toCamel(row as Record<string, unknown>) : null;
    if (!batch) return null;
    batch.items = db.prepare(`
      SELECT pbi.*, p.name_ar as material_name, p.sku as material_sku
      FROM production_batch_items pbi
      LEFT JOIN raw_materials rm ON rm.id = pbi.raw_material_id
      LEFT JOIN products p ON p.id = rm.product_id
      WHERE pbi.batch_id = ?
    `).all(id).map(toCamel);
    return batch;
  });

  ipcMain.handle('production:createBatch', async (_event, batch: Record<string, unknown>) => {
    const db = getDb();
    const now = getLocalTimestamp();

    const createBatch = db.transaction(() => {
      const formula = db.prepare(`
        SELECT f.*, fc.raw_material_id, fc.quantity as component_qty, fc.percentage, fc.component_type
        FROM formulas f
        JOIN formula_components fc ON fc.formula_id = f.id
        WHERE f.id = ?
      `).all(batch.formulaId) as Array<Record<string, unknown>>;

      if (formula.length === 0) throw new Error('Formula not found');

      const batchSize = formula[0].batch_size as number;
      if (!batchSize || batchSize <= 0) {
        throw new Error('Formula batch size must be greater than 0');
      }
      if (!batch.quantityPlanned || (batch.quantityPlanned as number) <= 0) {
        throw new Error('Quantity planned must be greater than 0');
      }

      const scaleFactor = (batch.quantityPlanned as number) / batchSize;

      let totalCost = 0;
      const batchItems: Array<{
        rawMaterialId: number;
        productId: number | null;
        quantityRequired: number;
        unitCost: number;
        totalCost: number;
      }> = [];

      for (const comp of formula) {
        const rawMaterial = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(comp.raw_material_id) as { product_id: number } | undefined;
        if (!rawMaterial) {
          throw new Error(`Raw material not found for component: ${comp.raw_material_id}`);
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(rawMaterial.product_id) as {
          id: number;
          current_stock: number;
          weighted_avg_cost: number;
          name_ar: string;
          unit: string;
        } | undefined;
        if (!product) {
          throw new Error(`Product not found for raw material: ${rawMaterial.product_id}`);
        }

        const quantityRequiredRaw = (comp.component_qty as number) * scaleFactor;
        const formulaUnit = (formula[0].batch_unit as string) || 'ml';
        const productUnit = product.unit || 'ml';

        const fromDim = getUnitDimension(formulaUnit);
        const toDim = getUnitDimension(productUnit);
        if (fromDim !== toDim && fromDim !== 'other' && toDim !== 'other') {
          throw new Error(`Cannot convert between ${formulaUnit} (volume) and ${productUnit} (weight) for ${product.name_ar}`);
        }

        const quantityRequired = convertUnit(quantityRequiredRaw, formulaUnit, productUnit);

        if (product.current_stock < quantityRequired) {
          throw new Error(`Insufficient stock for ${product.name_ar}: need ${quantityRequired.toFixed(2)} ${productUnit}, have ${product.current_stock} ${productUnit}`);
        }

        const unitCost = product.weighted_avg_cost;
        const itemCost = quantityRequired * unitCost;
        totalCost += itemCost;

        batchItems.push({
          rawMaterialId: comp.raw_material_id as number,
          productId: rawMaterial.product_id,
          quantityRequired,
          unitCost,
          totalCost: itemCost,
        });
      }

      const batchNumber = `BATCH-${Date.now()}`;
      const costPerUnit = (batch.quantityPlanned as number) > 0 ? totalCost / (batch.quantityPlanned as number) : 0;

      const bottleProductId = batch.bottleProductId || formula[0].bottle_product_id || null;
      const bottleSize = batch.bottleSize || formula[0].bottle_size || null;
      const bottleSizeUnit = batch.bottleSizeUnit || formula[0].bottle_size_unit || 'ml';

      let targetProductId = formula[0].target_product_id as number | null;

      if (!targetProductId) {
        const formulaNameAr = formula[0].name_ar as string;
        const formulaNameEn = formula[0].name_en as string;
        const existing = db.prepare(`
          SELECT id FROM products WHERE name_ar = ? AND size = ? AND size_unit = ? AND product_type = 'finished_perfume' AND active = 1
        `).get(formulaNameAr, bottleSize, bottleSizeUnit) as { id: number } | undefined;

        if (existing) {
          targetProductId = existing.id;
        } else {
          const sku = `FP-${Date.now()}`;
          const result = db.prepare(`
            INSERT INTO products (sku, name_ar, name_en, unit, size, size_unit, cost, weighted_avg_cost, retail_price, product_type, sellable, purchasable, producible, inventory_tracked, active, created_at, updated_at)
            VALUES (?, ?, ?, 'piece', ?, ?, ?, ?, ?, 'finished_perfume', 1, 0, 1, 1, 1, ?, ?)
          `).run(sku, formulaNameAr, formulaNameEn, bottleSize, bottleSizeUnit, costPerUnit, costPerUnit, 0, now, now);
          targetProductId = result.lastInsertRowid as number;
        }
      }

      const result = db.prepare(`
        INSERT INTO production_batches (batch_number, formula_id, target_product_id, bottle_product_id, bottle_size, bottle_size_unit, quantity_planned, quantity_produced, total_cost, cost_per_unit, status, notes, created_by, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).run(
        batchNumber, batch.formulaId, targetProductId,
        bottleProductId, bottleSize, bottleSizeUnit,
        batch.quantityPlanned, batch.quantityPlanned, totalCost, costPerUnit,
        batch.notes, batch.userId, now, now
      );

      const batchId = result.lastInsertRowid as number;

      const insertBatchItem = db.prepare(`
        INSERT INTO production_batch_items (batch_id, raw_material_id, product_id, quantity_required, quantity_used, unit_cost, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, unit_cost, total_cost, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'production', ?, ?, ?, ?)
      `);

      for (const item of batchItems) {
        insertBatchItem.run(batchId, item.rawMaterialId, item.productId, item.quantityRequired, item.quantityRequired, item.unitCost, item.totalCost);

        const product = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.productId!) as { current_stock: number };
        db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?').run(item.quantityRequired, now, item.productId);
        const newStock = product.current_stock - item.quantityRequired;

        insertMovement.run(item.productId, 'PRODUCTION_CONSUMPTION', -item.quantityRequired, product.current_stock, newStock, item.unitCost, item.totalCost, batchId, `Batch ${batchNumber} consumption`, batch.userId, now);
      }

      if (targetProductId) {
        const targetProduct = db.prepare('SELECT current_stock, weighted_avg_cost FROM products WHERE id = ?').get(targetProductId) as { current_stock: number; weighted_avg_cost: number };
        const existingStock = targetProduct.current_stock;
        const existingWAC = targetProduct.weighted_avg_cost;
        const newQty = batch.quantityPlanned as number;
        const newStock = existingStock + newQty;

        const blendedWAC = newStock > 0
          ? ((existingWAC * existingStock) + (costPerUnit * newQty)) / newStock
          : costPerUnit;

        db.prepare('UPDATE products SET current_stock = current_stock + ?, weighted_avg_cost = ?, cost = ?, updated_at = ? WHERE id = ?').run(
          newQty, blendedWAC, blendedWAC, now, targetProductId
        );

        insertMovement.run(targetProductId, 'PRODUCTION', newQty, existingStock, newStock, costPerUnit, totalCost, batchId, `Batch ${batchNumber} production`, batch.userId, now);
      }

      logAudit(batch.userId as number, 'production_created', 'production_batch', batchId, `Batch ${batchNumber} created`);
      return batchId;
    });

    return createBatch();
  });

  ipcMain.handle('production:previewBatch', async (_event, data: { formulaId: number; quantityPlanned: number; bottleProductId?: number; bottleSize?: number }) => {
    const db = getDb();
    const formula = db.prepare(`
      SELECT f.*, fc.raw_material_id, fc.quantity as component_qty, fc.percentage, fc.component_type
      FROM formulas f
      JOIN formula_components fc ON fc.formula_id = f.id
      WHERE f.id = ?
    `).all(data.formulaId) as Array<Record<string, unknown>>;

    if (formula.length === 0) throw new Error('Formula not found');

    const batchSize = formula[0].batch_size as number;
    if (!batchSize || batchSize <= 0) {
      throw new Error('Formula batch size must be greater than 0');
    }
    if (!data.quantityPlanned || data.quantityPlanned <= 0) {
      throw new Error('Quantity planned must be greater than 0');
    }

    const scaleFactor = data.quantityPlanned / batchSize;
    const formulaUnit = (formula[0].batch_unit as string) || 'ml';

    let totalCost = 0;
    const items: Array<{
      rawMaterialId: number;
      productId: number;
      materialName: string;
      materialSku: string;
      quantityRequired: number;
      currentStock: number;
      unitCost: number;
      totalCost: number;
      sufficient: boolean;
    }> = [];

    for (const comp of formula) {
      const rawMaterial = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(comp.raw_material_id) as { product_id: number } | undefined;
      if (!rawMaterial) throw new Error(`Raw material not found: ${comp.raw_material_id}`);

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(rawMaterial.product_id) as {
        id: number; current_stock: number; weighted_avg_cost: number; name_ar: string; sku: string; unit: string;
      } | undefined;
      if (!product) throw new Error(`Product not found: ${rawMaterial.product_id}`);

      const quantityRequiredRaw = (comp.component_qty as number) * scaleFactor;
      const productUnit = product.unit || 'ml';

      const fromDim = getUnitDimension(formulaUnit);
      const toDim = getUnitDimension(productUnit);
      if (fromDim !== toDim && fromDim !== 'other' && toDim !== 'other') {
        throw new Error(`Cannot convert between ${formulaUnit} (volume) and ${productUnit} (weight) for ${product.name_ar}`);
      }

      const quantityRequired = convertUnit(quantityRequiredRaw, formulaUnit, productUnit);
      const unitCost = product.weighted_avg_cost;
      const itemCost = quantityRequired * unitCost;
      totalCost += itemCost;

      items.push({
        rawMaterialId: comp.raw_material_id as number,
        productId: rawMaterial.product_id,
        materialName: product.name_ar,
        materialSku: product.sku,
        quantityRequired,
        currentStock: product.current_stock,
        unitCost,
        totalCost: itemCost,
        sufficient: product.current_stock >= quantityRequired,
      });
    }

    const costPerUnit = data.quantityPlanned > 0 ? totalCost / data.quantityPlanned : 0;
    const allSufficient = items.every(i => i.sufficient);

    return { items, totalCost, costPerUnit, batchSize, scaleFactor, allSufficient };
  });
}
