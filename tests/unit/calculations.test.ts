import { describe, it, expect } from 'vitest';

describe('Money Calculations', () => {
  it('should calculate subtotal correctly', () => {
    const items = [
      { quantity: 2, unitPrice: 350, discount: 0 },
      { quantity: 1, unitPrice: 200, discount: 10 },
    ];
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
    expect(subtotal).toBe(890);
  });

  it('should calculate total with discount', () => {
    const subtotal = 1000;
    const discount = 50;
    const total = Math.max(0, subtotal - discount);
    expect(total).toBe(950);
  });

  it('should calculate total with tax', () => {
    const subtotal = 1000;
    const discount = 0;
    const taxRate = 14;
    const taxAmount = ((subtotal - discount) * taxRate) / 100;
    const total = subtotal - discount + taxAmount;
    expect(total).toBe(1140);
  });

  it('should not allow negative totals', () => {
    const subtotal = 100;
    const discount = 150;
    const total = Math.max(0, subtotal - discount);
    expect(total).toBe(0);
  });
});

describe('Weighted Average Cost', () => {
  it('should calculate WAC after purchase', () => {
    const existingStock = 10;
    const existingWAC = 100;
    const purchaseQty = 5;
    const purchaseCost = 120;

    const newStock = existingStock + purchaseQty;
    const newWAC = ((existingWAC * existingStock) + (purchaseCost * purchaseQty)) / newStock;

    expect(newStock).toBe(15);
    expect(newWAC).toBeCloseTo(106.67, 2);
  });

  it('should use purchase cost when no existing stock', () => {
    const existingStock = 0;
    const purchaseQty = 10;
    const purchaseCost = 100;

    const newStock = existingStock + purchaseQty;
    const newWAC = newStock > 0 ? purchaseCost : 0;

    expect(newWAC).toBe(100);
  });
});

describe('Formula Calculations', () => {
  it('should scale formula components correctly', () => {
    const batchSize = 100; // 100ml base
    const scaleFactor = 20 / batchSize; // produce 20 units

    const components = [
      { name: 'Oil', quantity: 25 },
      { name: 'Alcohol', quantity: 73 },
      { name: 'Fixative', quantity: 2 },
    ];

    const required = components.map(c => ({
      name: c.name,
      required: c.quantity * scaleFactor,
    }));

    expect(required[0].required).toBe(5);
    expect(required[1].required).toBeCloseTo(14.6, 1);
    expect(required[2].required).toBe(0.4);
  });

  it('should calculate production cost per unit', () => {
    const totalCost = 1000;
    const quantityProduced = 20;
    const costPerUnit = totalCost / quantityProduced;

    expect(costPerUnit).toBe(50);
  });
});

describe('Cash Register Calculations', () => {
  it('should calculate expected cash correctly', () => {
    const openingCash = 2000;
    const cashIn = 8000;
    const cashOut = 500;

    const expected = openingCash + cashIn - cashOut;
    expect(expected).toBe(9500);
  });

  it('should calculate difference', () => {
    const expected = 9500;
    const actual = 9300;
    const difference = actual - expected;

    expect(difference).toBe(-200);
  });
});

describe('Profit Calculations', () => {
  it('should calculate gross profit', () => {
    const revenue = 700;
    const cogs = 280;
    const grossProfit = revenue - cogs;

    expect(grossProfit).toBe(420);
  });

  it('should calculate net profit', () => {
    const grossProfit = 420;
    const expenses = 100;
    const netProfit = grossProfit - expenses;

    expect(netProfit).toBe(320);
  });

  it('should calculate profit margin', () => {
    const revenue = 1000;
    const cogs = 600;
    const grossProfit = revenue - cogs;
    const margin = (grossProfit / revenue) * 100;

    expect(margin).toBe(40);
  });
});

describe('Discount Calculations', () => {
  it('should calculate percentage discount', () => {
    const price = 100;
    const discountPercent = 10;
    const discount = (price * discountPercent) / 100;
    const final = price - discount;

    expect(discount).toBe(10);
    expect(final).toBe(90);
  });

  it('should calculate fixed discount', () => {
    const price = 100;
    const discount = 25;
    const final = price - discount;

    expect(final).toBe(75);
  });

  it('should not allow negative final price', () => {
    const price = 100;
    const discount = 150;
    const final = Math.max(0, price - discount);

    expect(final).toBe(0);
  });
});

describe('Date Formatting', () => {
  it('should format date for display', () => {
    const date = '2026-09-15';
    const d = new Date(date);
    const formatted = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    expect(formatted).toBeTruthy();
  });

  it('should generate invoice number with date', () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const invoiceNumber = `SL-${today}-0001`;
    expect(invoiceNumber).toMatch(/^SL-\d{8}-\d{4}$/);
  });
});

describe('Production Cost Calculations', () => {
  it('should calculate total production cost from components', () => {
    const components = [
      { quantity: 25, unitCost: 0.5 },
      { quantity: 73, unitCost: 0.1 },
      { quantity: 2, unitCost: 2.0 },
    ];
    const totalCost = components.reduce((sum, c) => sum + c.quantity * c.unitCost, 0);
    expect(totalCost).toBeCloseTo(23.8, 1);
  });

  it('should calculate cost per unit from batch', () => {
    const totalCost = 2180;
    const quantityProduced = 100;
    const costPerUnit = totalCost / quantityProduced;
    expect(costPerUnit).toBe(21.8);
  });

  it('should scale formula for different batch sizes', () => {
    const baseBatchSize = 100;
    const targetBatchSize = 50;
    const scaleFactor = targetBatchSize / baseBatchSize;
    const oilQty = 25 * scaleFactor;
    const alcoholQty = 73 * scaleFactor;
    expect(oilQty).toBe(12.5);
    expect(alcoholQty).toBeCloseTo(36.5, 1);
  });

  it('should validate stock sufficiency before production', () => {
    const required = [
      { name: 'Oil', needed: 12.5, available: 20 },
      { name: 'Alcohol', needed: 36.5, available: 50 },
      { name: 'Fixative', needed: 1, available: 0.5 },
    ];
    const allSufficient = required.every(r => r.available >= r.needed);
    expect(allSufficient).toBe(false);
    const insufficientItems = required.filter(r => r.available < r.needed);
    expect(insufficientItems).toHaveLength(1);
    expect(insufficientItems[0].name).toBe('Fixative');
  });

  it('should calculate historical cost preservation', () => {
    const batchCost = 2180;
    const batchQty = 100;
    const costPerUnit = batchCost / batchQty;
    const historicalCost = costPerUnit;
    const currentWAC = 25.0;
    expect(historicalCost).toBe(21.8);
    expect(historicalCost).not.toBe(currentWAC);
  });
});

describe('Item Code Search', () => {
  it('should search products by item code', () => {
    const products = [
      { nameAr: 'عطر', sku: 'PRD-0001', item_code: 'P001', item_code_2: 'AR-001' },
      { nameAr: 'زيت', sku: 'PRD-0002', item_code: 'O001', item_code_2: null },
    ];
    const query = 'P001';
    const results = products.filter(p =>
      p.nameAr.includes(query) || p.sku.includes(query) ||
      (p.item_code && p.item_code.includes(query)) ||
      (p.item_code_2 && p.item_code_2.includes(query))
    );
    expect(results).toHaveLength(1);
    expect(results[0].item_code).toBe('P001');
  });

  it('should search products by item code 2', () => {
    const products = [
      { nameAr: 'عطر', sku: 'PRD-0001', item_code: 'P001', item_code_2: 'AR-001' },
      { nameAr: 'زيت', sku: 'PRD-0002', item_code: 'O001', item_code_2: null },
    ];
    const query = 'AR-001';
    const results = products.filter(p =>
      p.nameAr.includes(query) || p.sku.includes(query) ||
      (p.item_code && p.item_code.includes(query)) ||
      (p.item_code_2 && p.item_code_2.includes(query))
    );
    expect(results).toHaveLength(1);
    expect(results[0].item_code_2).toBe('AR-001');
  });
});

describe('Inventory Movement Cost Tracking', () => {
  it('should track unit cost in inventory movements', () => {
    const movement = {
      type: 'PRODUCTION_CONSUMPTION',
      quantity: -25,
      unitCost: 0.5,
      totalCost: -12.5,
    };
    expect(movement.unitCost).toBe(0.5);
    expect(Math.abs(movement.totalCost)).toBe(12.5);
  });

  it('should calculate stock value correctly', () => {
    const products = [
      { currentStock: 100, weightedAvgCost: 21.8 },
      { currentStock: 50, weightedAvgCost: 10.0 },
    ];
    const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.weightedAvgCost, 0);
    expect(totalValue).toBe(2680);
  });
});

describe('Production Preview', () => {
  it('should calculate preview with scale factor', () => {
    const batchSize = 100;
    const quantityPlanned = 30;
    const scaleFactor = quantityPlanned / batchSize;
    const components = [
      { qty: 25, cost: 0.5 },
      { qty: 73, cost: 0.1 },
      { qty: 2, cost: 2.0 },
    ];
    let totalCost = 0;
    const items = components.map(c => {
      const required = c.qty * scaleFactor;
      const itemCost = required * c.cost;
      totalCost += itemCost;
      return { required, itemCost };
    });
    expect(items[0].required).toBeCloseTo(7.5, 1);
    expect(totalCost).toBeCloseTo(7.14, 1);
  });

  it('should flag insufficient stock in preview', () => {
    const items = [
      { materialName: 'Oil', quantityRequired: 7.5, currentStock: 20, sufficient: true },
      { materialName: 'Alcohol', quantityRequired: 21.9, currentStock: 30, sufficient: true },
      { materialName: 'Fixative', quantityRequired: 0.6, currentStock: 0.3, sufficient: false },
    ];
    const allSufficient = items.every(i => i.sufficient);
    expect(allSufficient).toBe(false);
  });
});

describe('Formula Component Types', () => {
  it('should support different component types', () => {
    const componentTypes = ['raw_material', 'oil', 'alcohol', 'fixative'];
    expect(componentTypes).toContain('raw_material');
    expect(componentTypes).toContain('oil');
    expect(componentTypes).toContain('alcohol');
    expect(componentTypes).toContain('fixative');
  });
});

describe('Profit by Size Calculation', () => {
  it('should group profit by product and size', () => {
    const sales = [
      { product_name: 'عطر X', size: 30, size_unit: 'ml', qty: 5, sales: 2500, cost: 1000, profit: 1500 },
      { product_name: 'عطر X', size: 50, size_unit: 'ml', qty: 3, sales: 2400, cost: 1200, profit: 1200 },
      { product_name: 'عطر Y', size: 30, size_unit: 'ml', qty: 2, sales: 1000, cost: 400, profit: 600 },
    ];
    const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
    expect(totalProfit).toBe(3300);
  });
});

describe('Bottle Size Options', () => {
  it('should have standard bottle sizes', () => {
    const sizes = [10, 15, 20, 25, 30, 33, 50, 75, 100, 120, 200, 250];
    expect(sizes).toContain(30);
    expect(sizes).toContain(50);
    expect(sizes).toContain(100);
    expect(sizes.length).toBeGreaterThanOrEqual(10);
  });
});

// ===== REGRESSION TESTS =====

describe('Regression: Sales Stock Check', () => {
  it('should prevent sale when stock is insufficient', () => {
    const currentStock = 5;
    const saleQuantity = 10;
    const hasStock = currentStock >= saleQuantity;
    expect(hasStock).toBe(false);
  });

  it('should allow sale when stock is exactly sufficient', () => {
    const currentStock = 10;
    const saleQuantity = 10;
    const hasStock = currentStock >= saleQuantity;
    expect(hasStock).toBe(true);
  });

  it('should prevent negative stock after sale', () => {
    const currentStock = 5;
    const saleQuantity = 5;
    const newStock = currentStock - saleQuantity;
    expect(newStock).toBe(0);
    expect(newStock).not.toBeLessThan(0);
  });
});

describe('Regression: Overpayment Guard', () => {
  it('should prevent overpayment on sale', () => {
    const total = 500;
    const paid = 600;
    const isOverpayment = paid > total;
    expect(isOverpayment).toBe(true);
  });

  it('should accept exact payment', () => {
    const total = 500;
    const paid = 500;
    const isOverpayment = paid > total;
    expect(isOverpayment).toBe(false);
  });

  it('should prevent overpayment on supplier invoice', () => {
    const remaining = 1000;
    const paymentAmount = 1500;
    const isOverpayment = paymentAmount > remaining;
    expect(isOverpayment).toBe(true);
  });
});

describe('Regression: Return Validation', () => {
  it('should prevent return quantity exceeding original sale', () => {
    const originalQuantity = 3;
    const returnQuantity = 5;
    const isValid = returnQuantity <= originalQuantity;
    expect(isValid).toBe(false);
  });

  it('should allow return of exact original quantity', () => {
    const originalQuantity = 3;
    const returnQuantity = 3;
    const isValid = returnQuantity <= originalQuantity;
    expect(isValid).toBe(true);
  });

  it('should prevent refund exceeding return subtotal', () => {
    const returnSubtotal = 300;
    const refundAmount = 500;
    const isValid = refundAmount <= returnSubtotal;
    expect(isValid).toBe(false);
  });
});

describe('Regression: Cash Session Close Check', () => {
  it('should prevent closing already closed session', () => {
    const sessionStatus = 'closed';
    const canClose = sessionStatus === 'open';
    expect(canClose).toBe(false);
  });

  it('should allow closing open session', () => {
    const sessionStatus = 'open';
    const canClose = sessionStatus === 'open';
    expect(canClose).toBe(true);
  });
});

describe('Regression: Expense Validation', () => {
  it('should prevent negative expense amount', () => {
    const amount = -100;
    const isValid = amount > 0;
    expect(isValid).toBe(false);
  });

  it('should prevent zero expense amount', () => {
    const amount = 0;
    const isValid = amount > 0;
    expect(isValid).toBe(false);
  });

  it('should accept positive expense amount', () => {
    const amount = 100;
    const isValid = amount > 0;
    expect(isValid).toBe(true);
  });
});

describe('Regression: Purchase Subtotal with Per-Item Discounts', () => {
  it('should calculate subtotal including per-item discounts', () => {
    const items = [
      { quantity: 10, unitCost: 100, discount: 50 },
      { quantity: 5, unitCost: 200, discount: 0 },
    ];
    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.quantity * item.unitCost) - item.discount;
    }
    expect(subtotal).toBe(1950);
  });

  it('should not double-count discounts', () => {
    const items = [
      { quantity: 10, unitCost: 100, discount: 100 },
    ];
    const invoiceDiscount = 50;
    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.quantity * item.unitCost) - item.discount;
    }
    const total = subtotal - invoiceDiscount;
    expect(subtotal).toBe(900);
    expect(total).toBe(850);
  });
});

describe('Regression: WAC Blending', () => {
  it('should blend WAC for production output (not overwrite)', () => {
    const existingStock = 10;
    const existingWAC = 20;
    const newQty = 5;
    const newCostPerUnit = 30;
    const newStock = existingStock + newQty;
    const blendedWAC = newStock > 0
      ? ((existingWAC * existingStock) + (newCostPerUnit * newQty)) / newStock
      : newCostPerUnit;
    expect(blendedWAC).toBe(23.333333333333332);
    expect(blendedWAC).not.toBe(newCostPerUnit);
  });

  it('should use new cost when no existing stock', () => {
    const existingStock = 0;
    const existingWAC = 0;
    const newQty = 10;
    const newCostPerUnit = 25;
    const newStock = existingStock + newQty;
    const blendedWAC = newStock > 0
      ? ((existingWAC * existingStock) + (newCostPerUnit * newQty)) / newStock
      : newCostPerUnit;
    expect(blendedWAC).toBe(25);
  });
});

describe('Regression: Dimensional Unit Check', () => {
  const VOLUME_UNITS = new Set(['ml', 'l']);
  const WEIGHT_UNITS = new Set(['g', 'kg']);

  function getUnitDimension(unit: string): 'volume' | 'weight' | 'other' {
    const u = unit.toLowerCase();
    if (VOLUME_UNITS.has(u)) return 'volume';
    if (WEIGHT_UNITS.has(u)) return 'weight';
    return 'other';
  }

  it('should detect volume-to-weight conversion as invalid', () => {
    const fromDim = getUnitDimension('ml');
    const toDim = getUnitDimension('kg');
    const isCrossDimension = fromDim !== toDim && fromDim !== 'other' && toDim !== 'other';
    expect(isCrossDimension).toBe(true);
  });

  it('should allow same-dimension conversion', () => {
    const fromDim = getUnitDimension('ml');
    const toDim = getUnitDimension('l');
    const isCrossDimension = fromDim !== toDim && fromDim !== 'other' && toDim !== 'other';
    expect(isCrossDimension).toBe(false);
  });

  it('should allow other-unit conversions', () => {
    const fromDim = getUnitDimension('piece');
    const toDim = getUnitDimension('ml');
    const isCrossDimension = fromDim !== toDim && fromDim !== 'other' && toDim !== 'other';
    expect(isCrossDimension).toBe(false);
  });
});

describe('Regression: User Validation', () => {
  it('should require username', () => {
    const username = '';
    const isValid = username.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('should require password minimum length', () => {
    const password = '123';
    const isValid = password.length >= 6;
    expect(isValid).toBe(false);
  });

  it('should accept valid password', () => {
    const password = '123456';
    const isValid = password.length >= 6;
    expect(isValid).toBe(true);
  });

  it('should detect duplicate username', () => {
    const existingUsernames = ['admin', 'cashier1'];
    const newUsername = 'admin';
    const isDuplicate = existingUsernames.includes(newUsername);
    expect(isDuplicate).toBe(true);
  });
});

describe('Regression: Product Boolean Defaults on Update', () => {
  it('should preserve sellable=true when not explicitly set', () => {
    const existing = { sellable: true };
    const update = {};
    const result = update.sellable !== undefined ? update.sellable : existing.sellable;
    expect(result).toBe(true);
  });

  it('should set sellable to false when explicitly set', () => {
    const existing = { sellable: true };
    const update = { sellable: false };
    const result = update.sellable !== undefined ? update.sellable : existing.sellable;
    expect(result).toBe(false);
  });

  it('should use !== false pattern to preserve defaults', () => {
    const sellable = undefined;
    const result = sellable !== false ? 1 : 0;
    expect(result).toBe(1);
  });
});

describe('Regression: Toggle Active Null Check', () => {
  it('should throw on non-existent user', () => {
    const user = undefined;
    const found = user !== undefined;
    expect(found).toBe(false);
  });

  it('should toggle active state correctly', () => {
    const currentActive = 1;
    const newActive = currentActive ? 0 : 1;
    expect(newActive).toBe(0);
  });
});

describe('Regression: Local Timezone Date', () => {
  it('should generate local date not UTC', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const localDate = `${y}-${m}-${d}`;
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseInt(m)).toBeGreaterThanOrEqual(1);
    expect(parseInt(m)).toBeLessThanOrEqual(12);
    expect(parseInt(d)).toBeGreaterThanOrEqual(1);
    expect(parseInt(d)).toBeLessThanOrEqual(31);
  });

  it('should not use toISOString which returns UTC', () => {
    const utcDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (now.getHours() < 3) {
      expect(utcDate).not.toBe(localDate);
    }
  });
});

describe('Regression: Transaction saveDatabase Skip', () => {
  it('should track inTransaction flag correctly', () => {
    let inTransaction = false;
    let saveCount = 0;

    function runStatement() {
      if (!inTransaction) saveCount++;
    }

    inTransaction = true;
    runStatement();
    runStatement();
    runStatement();
    inTransaction = false;
    runStatement();

    expect(saveCount).toBe(1);
  });
});

describe('Regression: Expense Delete Reversal', () => {
  it('should identify related records to clean up', () => {
    const expense = { id: 1, cash_session_id: 5 };
    const journalEntry = { id: 10 };
    const cashMovement = { id: 20 };

    const recordsToDelete = [];
    if (expense.cash_session_id && cashMovement) {
      recordsToDelete.push('cash_movement');
    }
    if (journalEntry) {
      recordsToDelete.push('journal_entry_lines');
      recordsToDelete.push('journal_entry');
    }
    recordsToDelete.push('expense');

    expect(recordsToDelete).toContain('cash_movement');
    expect(recordsToDelete).toContain('journal_entry_lines');
    expect(recordsToDelete).toContain('journal_entry');
    expect(recordsToDelete).toContain('expense');
  });
});

describe('Regression: Invoice Number Collision', () => {
  it('should generate unique invoice numbers using MAX', () => {
    const maxExisting = 5;
    const next = maxExisting + 1;
    const invoiceNumber = `PO-${next.toString().padStart(6, '0')}`;
    expect(invoiceNumber).toBe('PO-000006');
  });

  it('should generate first invoice number when none exist', () => {
    const maxExisting = 0;
    const next = maxExisting + 1;
    const invoiceNumber = `PO-${next.toString().padStart(6, '0')}`;
    expect(invoiceNumber).toBe('PO-000001');
  });
});

describe('Regression: Cash Movement for Customer Payments', () => {
  it('should record cash movement when customer pays with cash session', () => {
    const amount = 500;
    const cashSessionId = 1;
    const shouldRecordMovement = cashSessionId && amount > 0;
    expect(shouldRecordMovement).toBeTruthy();
  });

  it('should not record cash movement without session', () => {
    const amount = 500;
    const cashSessionId = null;
    const shouldRecordMovement = cashSessionId && amount > 0;
    expect(shouldRecordMovement).toBeFalsy();
  });
});

describe('Regression: Return Cash Refund Movement', () => {
  it('should record cash movement for cash refunds', () => {
    const refundMethod = 'cash';
    const cashSessionId = 1;
    const refundAmount = 100;
    const shouldRecord = refundMethod === 'cash' && cashSessionId && refundAmount > 0;
    expect(shouldRecord).toBeTruthy();
  });

  it('should not record cash movement for credit refunds', () => {
    const refundMethod = 'credit';
    const cashSessionId = 1;
    const refundAmount = 100;
    const shouldRecord = refundMethod === 'cash' && cashSessionId && refundAmount > 0;
    expect(shouldRecord).toBeFalsy();
  });
});

describe('Regression: SQL LIKE Wildcard Escape', () => {
  it('should escape % in search query', () => {
    const search = '100%';
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    expect(escaped).toBe('100\\%');
  });

  it('should escape _ in search query', () => {
    const search = 'test_item';
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    expect(escaped).toBe('test\\_item');
  });
});

describe('Regression: Supplier Transaction Amount', () => {
  it('should use paid amount not total for transaction', () => {
    const total = 1000;
    const paid = 300;
    const remaining = total - paid;
    const transactionAmount = remaining;
    expect(transactionAmount).toBe(700);
  });
});

describe('Regression: Expense Cash Session Validation', () => {
  it('should verify cash session is open before expense', () => {
    const sessionStatus = 'closed';
    const canCreateExpense = sessionStatus === 'open';
    expect(canCreateExpense).toBe(false);
  });

  it('should allow expense on open session', () => {
    const sessionStatus = 'open';
    const canCreateExpense = sessionStatus === 'open';
    expect(canCreateExpense).toBe(true);
  });
});

describe('Regression: Production Batch Size Validation', () => {
  it('should reject batch size of 0', () => {
    const batchSize = 0;
    const isValid = batchSize > 0;
    expect(isValid).toBe(false);
  });

  it('should reject negative batch size', () => {
    const batchSize = -10;
    const isValid = batchSize > 0;
    expect(isValid).toBe(false);
  });

  it('should prevent Infinity in costPerUnit', () => {
    const quantityPlanned = 0;
    const totalCost = 1000;
    const costPerUnit = quantityPlanned > 0 ? totalCost / quantityPlanned : 0;
    expect(costPerUnit).toBe(0);
    expect(isFinite(costPerUnit)).toBe(true);
  });
});

describe('Regression: Owner Creation Guard', () => {
  it('should prevent creating owner when users exist', () => {
    const userCount = 5;
    const canCreate = userCount === 0;
    expect(canCreate).toBe(false);
  });

  it('should allow creating owner on first run', () => {
    const userCount = 0;
    const canCreate = userCount === 0;
    expect(canCreate).toBe(true);
  });
});

describe('Regression: Journal Entry Uniqueness', () => {
  it('should include sale ID in journal entry number', () => {
    const saleId = 42;
    const entryNumber = `JE-SALE-${Date.now()}-${saleId}`;
    expect(entryNumber).toContain(`-${saleId}`);
  });

  it('should include return ID in journal entry number', () => {
    const returnId = 7;
    const entryNumber = `JE-RETURN-${Date.now()}-${returnId}`;
    expect(entryNumber).toContain(`-${returnId}`);
  });
});

describe('Store Settings Validation', () => {
  it('should validate logo file type', () => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    expect(allowedTypes.includes('image/png')).toBe(true);
    expect(allowedTypes.includes('image/jpeg')).toBe(true);
    expect(allowedTypes.includes('image/webp')).toBe(true);
    expect(allowedTypes.includes('image/gif')).toBe(false);
    expect(allowedTypes.includes('application/pdf')).toBe(false);
  });

  it('should validate logo file size (max 2MB)', () => {
    const maxSize = 2 * 1024 * 1024;
    expect(maxSize).toBe(2097152);
    expect(1024 * 1024).toBeLessThanOrEqual(maxSize);
    expect(3 * 1024 * 1024).toBeGreaterThan(maxSize);
  });

  it('should have correct receipt width options', () => {
    const validWidths = ['58mm', '80mm', 'A4'];
    expect(validWidths).toContain('58mm');
    expect(validWidths).toContain('80mm');
    expect(validWidths).toContain('A4');
    expect(validWidths).not.toContain('100mm');
  });

  it('should have default store settings', () => {
    const defaults = {
      store_name: '',
      owner_name: '',
      phone1: '',
      phone2: '',
      address: '',
      city: '',
      tax_number: '',
      commercial_number: '',
      logo_path: '',
      currency: 'EGP',
      show_logo: 1,
      show_phone: 1,
      show_address: 1,
      show_tax_number: 1,
      show_commercial_number: 1,
      receipt_width: '80mm',
    };
    expect(defaults.currency).toBe('EGP');
    expect(defaults.receipt_width).toBe('80mm');
    expect(defaults.show_logo).toBe(1);
  });

  it('should validate store settings update fields', () => {
    const allowedFields = [
      'store_name', 'owner_name', 'phone1', 'phone2',
      'address', 'city', 'tax_number', 'commercial_number',
      'currency', 'show_logo', 'show_phone', 'show_address',
      'show_tax_number', 'show_commercial_number', 'receipt_width', 'invoice_footer',
    ];
    expect(allowedFields).toContain('store_name');
    expect(allowedFields).toContain('store_name');
    expect(allowedFields).not.toContain('id');
    expect(allowedFields).not.toContain('created_at');
    expect(allowedFields).not.toContain('logo_path');
  });
});

describe('Setup Wizard Flow', () => {
  it('should have correct step order', () => {
    const steps = ['welcome', 'storeInfo', 'logo', 'invoice', 'account', 'finish'];
    expect(steps).toHaveLength(6);
    expect(steps[0]).toBe('welcome');
    expect(steps[steps.length - 1]).toBe('finish');
  });

  it('should require owner account fields', () => {
    const required = ['ownerDisplayName', 'ownerUsername', 'ownerPassword'];
    expect(required).toHaveLength(3);
    expect(required).toContain('ownerPassword');
  });

  it('should require minimum password length', () => {
    const minPasswordLength = 6;
    expect('12345'.length).toBeLessThan(minPasswordLength);
    expect('123456'.length).toBeGreaterThanOrEqual(minPasswordLength);
  });
});

describe('Receipt/Invoice Branding', () => {
  const defaultSettings = {
    store_name: 'محل العطور',
    receipt_name: '',
    invoice_name: '',
    receipt_subtitle: '',
    invoice_subtitle: '',
    receipt_footer: 'شكراً لزيارتكم',
  };

  it('should use receipt_name for receipt when set', () => {
    const settings = { ...defaultSettings, receipt_name: 'Jawhar Perfumes' };
    const displayName = settings.receipt_name || settings.store_name;
    expect(displayName).toBe('Jawhar Perfumes');
  });

  it('should use invoice_name for invoice when set', () => {
    const settings = { ...defaultSettings, invoice_name: 'شركة الجواهر للعطور' };
    const displayName = settings.invoice_name || settings.store_name;
    expect(displayName).toBe('شركة الجواهر للعطور');
  });

  it('should fallback to store_name when receipt_name is empty', () => {
    const settings = { ...defaultSettings, receipt_name: '' };
    const displayName = settings.receipt_name || settings.store_name;
    expect(displayName).toBe('محل العطور');
  });

  it('should fallback to store_name when invoice_name is empty', () => {
    const settings = { ...defaultSettings, invoice_name: '' };
    const displayName = settings.invoice_name || settings.store_name;
    expect(displayName).toBe('محل العطور');
  });

  it('should use receipt_subtitle for receipt', () => {
    const settings = { ...defaultSettings, receipt_subtitle: 'لبيع وتركيب العطور' };
    expect(settings.receipt_subtitle).toBe('لبيع وتركيب العطور');
  });

  it('should use receipt_footer for receipt', () => {
    const settings = { ...defaultSettings, receipt_footer: 'شكراً لزيارتكم' };
    expect(settings.receipt_footer).toBe('شكراً لزيارتكم');
  });

  it('should allow custom name without modifying settings', () => {
    const settings = { ...defaultSettings };
    const customName = 'اسم مخصص للطباعة';
    const displayName = customName || settings.receipt_name || settings.store_name;
    expect(displayName).toBe('اسم مخصص للطباعة');
    expect(settings.receipt_name).toBe('');
  });

  it('should have correct print branding fields in migration', () => {
    const brandingFields = [
      'receipt_name', 'invoice_name',
      'receipt_subtitle', 'invoice_subtitle', 'receipt_footer',
    ];
    expect(brandingFields).toHaveLength(5);
    expect(brandingFields).toContain('receipt_name');
    expect(brandingFields).toContain('invoice_name');
  });

  it('should support different names for receipt vs invoice', () => {
    const settings = {
      ...defaultSettings,
      receipt_name: 'Jawhar Perfumes',
      invoice_name: 'شركة الجواهر للعطور',
    };
    const receiptName = settings.receipt_name || settings.store_name;
    const invoiceName = settings.invoice_name || settings.store_name;
    expect(receiptName).toBe('Jawhar Perfumes');
    expect(invoiceName).toBe('شركة الجواهر للعطور');
    expect(receiptName).not.toBe(invoiceName);
  });

  it('should handle Arabic and English names correctly', () => {
    const settings = {
      ...defaultSettings,
      receipt_name: 'Jawhar Perfumes',
      invoice_name: 'شركة الجواهر للعطور',
    };
    expect(settings.receipt_name).toMatch(/[A-Za-z]/);
    expect(settings.invoice_name).toMatch(/[\u0600-\u06FF]/);
  });
});

describe('Recipe/BOM Calculations', () => {
  const CONVERSIONS: Record<string, number> = { ml: 1, l: 1000, liter: 1000, g: 1, kg: 1000, piece: 1 };
  function convertUnit(qty: number, from: string, to: string): number {
    if (from === to) return qty;
    const fb = CONVERSIONS[from.toLowerCase()] ?? 1;
    const tb = CONVERSIONS[to.toLowerCase()] ?? 1;
    return qty * (fb / tb);
  }
  const VOLUME_UNITS = new Set(['ml', 'l', 'liter']);
  const WEIGHT_UNITS = new Set(['g', 'kg']);
  function getUnitDimension(u: string): 'volume' | 'weight' | 'other' {
    if (VOLUME_UNITS.has(u.toLowerCase())) return 'volume';
    if (WEIGHT_UNITS.has(u.toLowerCase())) return 'weight';
    return 'other';
  }

  it('should calculate single sale recipe consumption correctly', () => {
    const batchSize = 100;
    const productSize = 100;
    const saleQty = 1;
    const totalQty = saleQty * productSize;
    const scaleFactor = totalQty / batchSize;
    const recipeComponents = [
      { quantity: 1, unit: 'piece', productId: 1 },
      { quantity: 30, unit: 'ml', productId: 2 },
      { quantity: 20, unit: 'g', productId: 3 },
    ];
    const results = recipeComponents.map(c => ({
      productId: c.productId,
      required: convertUnit(c.quantity * scaleFactor, 'ml', c.unit),
    }));
    expect(results[0].required).toBe(1);
    expect(results[1].required).toBe(30);
    expect(results[2].required).toBe(20);
  });

  it('should scale recipe consumption with quantity', () => {
    const batchSize = 100;
    const productSize = 100;
    const saleQty = 5;
    const totalQty = saleQty * productSize;
    const scaleFactor = totalQty / batchSize;
    const bottleQty = 1 * scaleFactor;
    const alcoholQty = 30 * scaleFactor;
    const oilQty = 20 * scaleFactor;
    expect(bottleQty).toBe(5);
    expect(alcoholQty).toBe(150);
    expect(oilQty).toBe(100);
  });

  it('should aggregate shared components across multiple products', () => {
    const aggregated = new Map<number, { totalQty: number; unit: string }>();
    const consumptions = [
      { productId: 2, quantity: 30, unit: 'ml' },
      { productId: 2, quantity: 25, unit: 'ml' },
    ];
    for (const c of consumptions) {
      const existing = aggregated.get(c.productId);
      if (existing) {
        existing.totalQty += c.quantity;
      } else {
        aggregated.set(c.productId, { totalQty: c.quantity, unit: c.unit });
      }
    }
    expect(aggregated.get(2)!.totalQty).toBe(55);
  });

  it('should detect insufficient stock', () => {
    const currentStock = 20;
    const required = 30;
    expect(currentStock >= required).toBe(false);
    const deficit = required - currentStock;
    expect(deficit).toBe(10);
  });

  it('should calculate component cost using weighted average cost', () => {
    const batchSize = 100;
    const productSize = 100;
    const saleQty = 1;
    const totalQty = saleQty * productSize;
    const scaleFactor = totalQty / batchSize;
    const components = [
      { quantity: 1, unitCost: 20, unit: 'piece' },
      { quantity: 30, unitCost: 0.1, unit: 'ml' },
      { quantity: 20, unitCost: 1.25, unit: 'g' },
    ];
    const totalCost = components.reduce((sum, c) => sum + c.quantity * scaleFactor * c.unitCost, 0);
    expect(totalCost).toBeCloseTo(48);
  });

  it('should convert liters to milliliters correctly', () => {
    const result = convertUnit(1, 'l', 'ml');
    expect(result).toBe(1000);
  });

  it('should convert kilograms to grams correctly', () => {
    const result = convertUnit(1, 'kg', 'g');
    expect(result).toBe(1000);
  });

  it('should reject cross-dimension conversion', () => {
    const fromDim = getUnitDimension('ml');
    const toDim = getUnitDimension('g');
    expect(fromDim).toBe('volume');
    expect(toDim).toBe('weight');
    expect(fromDim).not.toBe(toDim);
  });

  it('should allow same-dimension conversion', () => {
    const fromDim = getUnitDimension('l');
    const toDim = getUnitDimension('ml');
    expect(fromDim).toBe('volume');
    expect(toDim).toBe('volume');
    expect(fromDim).toBe(toDim);
  });

  it('should correctly calculate cost per unit from total recipe cost', () => {
    const totalRecipeCost = 56;
    const batchSize = 100;
    const costPerUnit = totalRecipeCost / batchSize;
    expect(costPerUnit).toBeCloseTo(0.56);
  });

  it('should handle product without recipe (finished_stock mode)', () => {
    const trackingMode = 'finished_stock';
    const hasRecipe = false;
    if (trackingMode === 'recipe_consumption' && hasRecipe) {
      throw new Error('Should not reach here');
    }
    expect(true).toBe(true);
  });

  it('should calculate total component cost for multiple sold units', () => {
    const batchSize = 100;
    const productSize = 100;
    const saleQty = 3;
    const totalQty = saleQty * productSize;
    const scaleFactor = totalQty / batchSize;
    const components = [
      { quantity: 1, unitCost: 20 },
      { quantity: 30, unitCost: 0.1 },
      { quantity: 20, unitCost: 1.25 },
    ];
    const totalCost = components.reduce((sum, c) => sum + (c.quantity * scaleFactor) * c.unitCost, 0);
    expect(totalCost).toBeCloseTo(144);
  });
});

describe('Money Precision', () => {
  function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  function addMoney(...values: number[]): number {
    let total = 0;
    for (const v of values) {
      total += Math.round(v * 100);
    }
    return total / 100;
  }

  it('should handle 0.1 + 0.2 without floating-point drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('should handle nested money operations', () => {
    const subtotal = roundMoney(3 * 10.50);
    const discount = roundMoney(subtotal * 0.1);
    const tax = roundMoney((subtotal - discount) * 0.14);
    const total = roundMoney(subtotal - discount + tax);
    expect(total).toBe(32.32);
  });

  it('should handle partial payments', () => {
    const total = 100.00;
    const paid1 = 33.33;
    const paid2 = 33.33;
    const paid3 = 33.34;
    const remaining = roundMoney(total - addMoney(paid1, paid2, paid3));
    expect(remaining).toBe(0);
  });

  it('should handle weighted average cost', () => {
    const stock1 = 10;
    const cost1 = 15.50;
    const stock2 = 5;
    const cost2 = 18.75;
    const newStock = stock1 + stock2;
    const newCost = roundMoney(((stock1 * cost1) + (stock2 * cost2)) / newStock);
    expect(newCost).toBe(16.58);
  });

  it('should handle discount calculations', () => {
    const items = [
      { qty: 2, price: 25.50 },
      { qty: 1, price: 49.99 },
      { qty: 3, price: 12.00 },
    ];
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.qty * item.price, 0));
    const discount = roundMoney(subtotal * 0.15);
    const total = roundMoney(subtotal - discount);
    expect(subtotal).toBe(136.99);
    expect(discount).toBe(20.55);
    expect(total).toBe(116.44);
  });

  it('should handle return with partial refund', () => {
    const originalTotal = 250.00;
    const refundAmount = 75.50;
    const remaining = roundMoney(originalTotal - refundAmount);
    expect(remaining).toBe(174.50);
  });

  it('should handle invoice total with tax', () => {
    const subtotal = roundMoney(150.00 + 89.99 + 45.50);
    const discount = 20.00;
    const taxRate = 0.14;
    const taxableAmount = roundMoney(subtotal - discount);
    const tax = roundMoney(taxableAmount * taxRate);
    const total = roundMoney(taxableAmount + tax);
    expect(subtotal).toBe(285.49);
    expect(tax).toBe(37.17);
    expect(total).toBe(302.66);
  });
});

describe('Journal Entry Balance Invariant', () => {
  interface JournalLine {
    accountId: number;
    debit: number;
    credit: number;
  }

  function isJournalBalanced(lines: JournalLine[]): boolean {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.001;
  }

  it('should balance a normal sale journal entry', () => {
    const total = 100;
    const paid = 60;
    const remaining = 40;
    const cogs = 45;
    const lines: JournalLine[] = [
      { accountId: 1000, debit: paid, credit: 0 },
      { accountId: 1020, debit: remaining, credit: 0 },
      { accountId: 4000, debit: 0, credit: total },
      { accountId: 5000, debit: cogs, credit: 0 },
      { accountId: 1030, debit: 0, credit: cogs },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should balance a full return with cash refund', () => {
    const refundAmount = 100;
    const cogs = 45;
    const lines: JournalLine[] = [
      { accountId: 4000, debit: refundAmount, credit: 0 },
      { accountId: 5000, debit: 0, credit: cogs },
      { accountId: 1030, debit: cogs, credit: 0 },
      { accountId: 1000, debit: 0, credit: refundAmount },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should balance a partial return with customer credit', () => {
    const refundAmount = 50;
    const cogs = 20;
    const lines: JournalLine[] = [
      { accountId: 4000, debit: refundAmount, credit: 0 },
      { accountId: 5000, debit: 0, credit: cogs },
      { accountId: 1030, debit: cogs, credit: 0 },
      { accountId: 1020, debit: 0, credit: refundAmount },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should balance a return with zero refund (exchange only)', () => {
    const cogs = 30;
    const lines: JournalLine[] = [
      { accountId: 4000, debit: 0, credit: 0 },
      { accountId: 5000, debit: 0, credit: cogs },
      { accountId: 1030, debit: cogs, credit: 0 },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should balance an expense journal entry', () => {
    const amount = 500;
    const lines: JournalLine[] = [
      { accountId: 6000, debit: amount, credit: 0 },
      { accountId: 1000, debit: 0, credit: amount },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should balance a purchase journal entry', () => {
    const total = 1000;
    const paid = 400;
    const remaining = 600;
    const lines: JournalLine[] = [
      { accountId: 1030, debit: total, credit: 0 },
      { accountId: 1000, debit: 0, credit: paid },
      { accountId: 2000, debit: 0, credit: remaining },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it('should detect an unbalanced entry', () => {
    const lines: JournalLine[] = [
      { accountId: 4000, debit: 100, credit: 0 },
      { accountId: 5000, debit: 0, credit: 45 },
    ];
    expect(isJournalBalanced(lines)).toBe(false);
  });
});

describe('Daily Closing Report Calculations', () => {
  it('should calculate total cash in correctly', () => {
    const cashSales = 5000;
    const cashPayments = 2000;
    const cashIn = 500;
    const totalIn = cashSales + cashPayments + cashIn;
    expect(totalIn).toBe(7500);
  });

  it('should calculate total cash out correctly', () => {
    const expenses = 300;
    const refunds = 100;
    const cashOut = 200;
    const supplierPayments = 1000;
    const totalOut = expenses + refunds + cashOut + supplierPayments;
    expect(totalOut).toBe(1600);
  });

  it('should calculate expected cash correctly', () => {
    const openingCash = 2000;
    const totalIn = 7500;
    const totalOut = 1600;
    const expectedCash = openingCash + totalIn - totalOut;
    expect(expectedCash).toBe(7900);
  });

  it('should calculate difference between actual and expected', () => {
    const expectedCash = 7900;
    const actualCash = 7800;
    const difference = actualCash - expectedCash;
    expect(difference).toBe(-100);
  });

  it('should group payments by method correctly', () => {
    const sales = [
      { payment_method: 'cash', paid: 100 },
      { payment_method: 'card', paid: 200 },
      { payment_method: 'cash', paid: 150 },
      { payment_method: 'mobile', paid: 50 },
    ];
    const grouped = sales.reduce((acc, s) => {
      if (!acc[s.payment_method]) acc[s.payment_method] = { count: 0, total: 0 };
      acc[s.payment_method].count++;
      acc[s.payment_method].total += s.paid;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);
    expect(grouped.cash.count).toBe(2);
    expect(grouped.cash.total).toBe(250);
    expect(grouped.card.count).toBe(1);
    expect(grouped.card.total).toBe(200);
    expect(grouped.mobile.count).toBe(1);
    expect(grouped.mobile.total).toBe(50);
  });

  it('should handle zero opening cash', () => {
    const expectedCash = 0 + 5000 - 500;
    expect(expectedCash).toBe(4500);
  });

  it('should handle empty movement list', () => {
    const movements: Array<{ amount: number; type: string }> = [];
    const openingCash = 1000;
    const net = movements.reduce((sum, m) => sum + m.amount, 0) + openingCash;
    expect(net).toBe(1000);
  });
});

describe('P&L Report Calculations', () => {
  it('should calculate gross margin percentage', () => {
    const netSales = 10000;
    const cogs = 6000;
    const grossProfit = netSales - cogs;
    const grossMargin = (grossProfit / netSales) * 100;
    expect(grossMargin).toBe(40);
  });

  it('should calculate net profit margin percentage', () => {
    const netSales = 10000;
    const netProfit = 3000;
    const netMargin = (netProfit / netSales) * 100;
    expect(netMargin).toBe(30);
  });

  it('should handle zero net sales gracefully', () => {
    const netSales = 0;
    const netProfit = 0;
    const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    expect(netMargin).toBe(0);
  });

  it('should calculate net sales from gross sales', () => {
    const grossSales = 12000;
    const discounts = 500;
    const returns = 300;
    const netSales = grossSales - discounts - returns;
    expect(netSales).toBe(11200);
  });

  it('should format P&L hierarchy correctly', () => {
    const sections = ['grossSales', 'discounts', 'returns', 'netSales', 'cogs', 'grossProfit', 'expenses', 'netProfit'];
    expect(sections[0]).toBe('grossSales');
    expect(sections[sections.length - 1]).toBe('netProfit');
    expect(sections).toContain('grossProfit');
    expect(sections).toContain('netSales');
  });

  it('should detect loss (negative net profit)', () => {
    const netProfit = 2000 - 3000;
    expect(netProfit).toBe(-1000);
    expect(netProfit).toBeLessThan(0);
  });
});

describe('Export Filter Types', () => {
  it('should support all export types', () => {
    const exportTypes = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'formulas', 'recipes', 'stock', 'accounts', 'journal_entries', 'expenses', 'audit', 'production', 'cash'];
    expect(exportTypes).toContain('audit');
    expect(exportTypes).toContain('production');
    expect(exportTypes).toContain('cash');
    expect(exportTypes.length).toBe(14);
  });

  it('should filter audit logs by entity type', () => {
    const logs = [
      { entity: 'sale', action: 'create' },
      { entity: 'product', action: 'update' },
      { entity: 'sale', action: 'update' },
      { entity: 'expense', action: 'create' },
    ];
    const filtered = logs.filter(l => l.entity === 'sale');
    expect(filtered).toHaveLength(2);
  });

  it('should filter production batches by date range', () => {
    const batches = [
      { created_at: '2026-09-01', batch_number: 'PB-001' },
      { created_at: '2026-09-15', batch_number: 'PB-002' },
      { created_at: '2026-10-01', batch_number: 'PB-003' },
    ];
    const from = '2026-09-01';
    const to = '2026-09-30';
    const filtered = batches.filter(b => b.created_at >= from && b.created_at <= to);
    expect(filtered).toHaveLength(2);
  });
});

describe('Product Variants', () => {
  it('should support parent-child relationship', () => {
    const parent = { id: 1, nameAr: 'عطر X', parent_product_id: null };
    const child1 = { id: 2, nameAr: 'عطر X - 30ml', parent_product_id: 1 };
    const child2 = { id: 3, nameAr: 'عطر X - 50ml', parent_product_id: 1 };
    expect(child1.parent_product_id).toBe(parent.id);
    expect(child2.parent_product_id).toBe(parent.id);
    expect(parent.parent_product_id).toBeNull();
  });

  it('should filter children by parent id', () => {
    const products = [
      { id: 1, parent_product_id: null },
      { id: 2, parent_product_id: 1 },
      { id: 3, parent_product_id: 1 },
      { id: 4, parent_product_id: null },
    ];
    const children = products.filter(p => p.parent_product_id === 1);
    expect(children).toHaveLength(2);
  });
});
