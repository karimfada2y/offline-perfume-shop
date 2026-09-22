import { ipcMain } from 'electron';
import { getDb } from '../database/wrapper';
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

export function registerReportHandlers(): void {
  ipcMain.handle('reports:dashboard', async () => {
    const db = getDb();
    const today = getLocalDate();
    const monthStart = today.substring(0, 7) + '-01';

    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
      FROM sales WHERE date = ? AND created_at IS NOT NULL
    `).get(today) as { total: number; count: number };

    const todayProfit = db.prepare(`
      SELECT COALESCE(SUM(si.total - si.cost * si.quantity), 0) as profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date = ?
    `).get(today) as { profit: number };

    const todayDiscount = db.prepare(`
      SELECT COALESCE(SUM(discount), 0) as total
      FROM sales WHERE date = ?
    `).get(today) as { total: number };

    const monthSales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
      FROM sales WHERE date >= ? AND date <= ?
    `).get(monthStart, today) as { total: number; count: number };

    const monthProfit = db.prepare(`
      SELECT COALESCE(SUM(si.total - si.cost * si.quantity), 0) as profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ?
    `).get(monthStart, today) as { profit: number };

    const monthExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE date >= ? AND date <= ?
    `).get(monthStart, today) as { total: number };

    const lowStock = db.prepare(`
      SELECT * FROM products WHERE active = 1 AND inventory_tracked = 1 AND current_stock <= minimum_stock AND minimum_stock > 0
      ORDER BY current_stock ASC
      LIMIT 10
    `).all().map(toCamel);

    const topProducts = db.prepare(`
      SELECT si.product_name, SUM(si.quantity) as total_qty, SUM(si.total) as total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `).all(monthStart, today).map(toCamel);

    const customerDebt = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as total
      FROM customers WHERE active = 1 AND current_balance > 0
    `).get() as { total: number };

    const supplierDebt = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as total
      FROM suppliers WHERE active = 1 AND current_balance > 0
    `).get() as { total: number };

    const cashSessionRaw = db.prepare(`
      SELECT cs.*, cr.name as register_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cr.id = cs.register_id
      WHERE cs.status = 'open'
      LIMIT 1
    `).get();
    const cashSession = cashSessionRaw ? toCamel(cashSessionRaw as Record<string, unknown>) : null;

    const todayProduction = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_cost), 0) as cost
      FROM production_batches WHERE date(created_at) = ?
    `).get(today) as { count: number; cost: number };

    return {
      todaySales: todaySales.total,
      todayOrders: todaySales.count,
      todayProfit: todayProfit.profit - todayDiscount.total,
      monthSales: monthSales.total,
      monthOrders: monthSales.count,
      monthProfit: monthProfit.profit,
      monthExpenses: monthExpenses.total,
      monthNetProfit: monthProfit.profit - monthExpenses.total,
      lowStock,
      topProducts,
      customerDebt: customerDebt.total,
      supplierDebt: supplierDebt.total,
      cashSession,
      todayProduction: todayProduction.count,
      todayProductionCost: todayProduction.cost,
    };
  });

  ipcMain.handle('reports:sales', async (_event, filters?: { from?: string; to?: string }) => {
    const db = getDb();
    const from = filters?.from || getLocalDate();
    const to = filters?.to || from;

    const salesByDay = db.prepare(`
      SELECT date, COUNT(*) as count, SUM(total) as total, SUM(discount) as discounts
      FROM sales WHERE date >= ? AND date <= ?
      GROUP BY date ORDER BY date
    `).all(from, to).map(toCamel);

    const salesByPayment = db.prepare(`
      SELECT payment_method, COUNT(*) as count, SUM(total) as total
      FROM sales WHERE date >= ? AND date <= ?
      GROUP BY payment_method
    `).all(from, to).map(toCamel);

    const topProducts = db.prepare(`
      SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.total) as revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY revenue DESC
      LIMIT 10
    `).all(from, to).map(toCamel);

    return { salesByDay, salesByPayment, topProducts };
  });

  ipcMain.handle('reports:profit', async (_event, filters?: { from?: string; to?: string; groupBy?: string }) => {
    const db = getDb();
    const from = filters?.from || getLocalDate();
    const to = filters?.to || from;

    const sales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as grossSales, COALESCE(SUM(discount), 0) as discounts
      FROM sales WHERE date >= ? AND date <= ?
    `).get(from, to) as { grossSales: number; discounts: number };

    const returns = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM sale_returns WHERE date >= ? AND date <= ?
    `).get(from, to) as { total: number };

    const cogs = db.prepare(`
      SELECT COALESCE(SUM(si.cost * si.quantity), 0) as total
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ?
    `).get(from, to) as { total: number };

    const cogsReversal = db.prepare(`
      SELECT COALESCE(SUM(sri.cost * sri.quantity), 0) as total
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id = sri.sale_return_id
      WHERE sr.date >= ? AND sr.date <= ?
    `).get(from, to) as { total: number };

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE date >= ? AND date <= ?
    `).get(from, to) as { total: number };

    const netSales = sales.grossSales - sales.discounts - returns.total;
    const grossProfit = netSales - cogs.total + cogsReversal.total;
    const netProfit = grossProfit - expenses.total;

    let byCategory: Array<{ category: string; sales: number; cost: number; profit: number }> = [];
    if (filters?.groupBy === 'category') {
      byCategory = db.prepare(`
        SELECT COALESCE(c.name_ar, 'Other') as category,
               SUM(si.total) as sales, SUM(si.cost * si.quantity) as cost,
               SUM(si.total - si.cost * si.quantity) as profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products pr ON pr.id = si.product_id
        LEFT JOIN categories c ON c.id = pr.category_id
        WHERE s.date >= ? AND s.date <= ?
        GROUP BY pr.category_id, c.name_ar ORDER BY profit DESC
      `).all(from, to).map(toCamel) as Array<{ category: string; sales: number; cost: number; profit: number }>;
    }

    let byProduct: Array<{ product_name: string; qty: number; sales: number; cost: number; profit: number }> = [];
    if (filters?.groupBy === 'product') {
      byProduct = db.prepare(`
        SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.total) as sales,
               SUM(si.cost * si.quantity) as cost, SUM(si.total - si.cost * si.quantity) as profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.date >= ? AND s.date <= ?
        GROUP BY si.product_id, si.product_name ORDER BY profit DESC
      `).all(from, to).map(toCamel) as Array<{ product_name: string; qty: number; sales: number; cost: number; profit: number }>;
    }

    return {
      grossSales: sales.grossSales,
      discounts: sales.discounts,
      returns: returns.total,
      netSales,
      cogs: cogs.total,
      grossProfit,
      expenses: expenses.total,
      netProfit,
      byCategory,
      byProduct,
    };
  });

  ipcMain.handle('reports:inventory', async (_event, filters?: { productType?: string }) => {
    const db = getDb();
    let query = `
      SELECT p.*, c.name_ar as category_name, b.name_ar as brand_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.active = 1 AND p.inventory_tracked = 1
    `;
    const params: unknown[] = [];
    if (filters?.productType) {
      query += ' AND p.product_type = ?';
      params.push(filters.productType);
    }
    query += ' ORDER BY p.name_ar';
    const products = db.prepare(query).all(...params).map(toCamel);

    const totalValue = db.prepare(`
      SELECT COALESCE(SUM(current_stock * weighted_avg_cost), 0) as value
      FROM products WHERE active = 1 AND inventory_tracked = 1
    `).get() as { value: number };

    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products
      WHERE active = 1 AND inventory_tracked = 1 AND current_stock <= minimum_stock AND minimum_stock > 0
    `).get() as { count: number };

    const byType = db.prepare(`
      SELECT product_type, COUNT(*) as count, COALESCE(SUM(current_stock * weighted_avg_cost), 0) as value
      FROM products WHERE active = 1 AND inventory_tracked = 1
      GROUP BY product_type ORDER BY value DESC
    `).all().map(toCamel);

    return { products, totalValue: totalValue.value, lowStockCount: lowStock.count, byType };
  });

  ipcMain.handle('reports:production', async (_event, filters?: { from?: string; to?: string; formulaId?: number }) => {
    const db = getDb();
    let query = `
      SELECT pb.*, f.name_ar as formula_name, p.name_ar as product_name, u.display_name as user_name,
             bp.name_ar as bottle_product_name
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
    const batches = db.prepare(query).all(...params).map(toCamel);

    let summaryQuery = `SELECT COUNT(*) as totalBatches, COALESCE(SUM(total_cost), 0) as totalCost, COALESCE(SUM(quantity_produced), 0) as totalProduced FROM production_batches WHERE 1=1`;
    const summaryParams: unknown[] = [];
    if (filters?.from) { summaryQuery += ' AND created_at >= ?'; summaryParams.push(filters.from); }
    if (filters?.to) { summaryQuery += ' AND created_at <= ?'; summaryParams.push(filters.to + 'T23:59:59'); }
    const summary = db.prepare(summaryQuery).get(...summaryParams) as { totalBatches: number; totalCost: number; totalProduced: number };

    return { batches, summary };
  });

  ipcMain.handle('reports:materialConsumption', async (_event, filters?: { from?: string; to?: string }) => {
    const db = getDb();
    let query = `
      SELECT p.name_ar as material_name, p.sku, p.item_code,
             SUM(pbi.quantity_used) as total_used, SUM(pbi.total_cost) as total_cost,
             p.current_stock, p.unit
      FROM production_batch_items pbi
      JOIN production_batches pb ON pb.id = pbi.batch_id
      JOIN raw_materials rm ON rm.id = pbi.raw_material_id
      JOIN products p ON p.id = rm.product_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters?.from) { query += ' AND pb.created_at >= ?'; params.push(filters.from); }
    if (filters?.to) { query += ' AND pb.created_at <= ?'; params.push(filters.to + 'T23:59:59'); }
    query += ' GROUP BY pbi.raw_material_id, p.name_ar, p.sku, p.item_code, p.current_stock, p.unit ORDER BY total_used DESC';
    return db.prepare(query).all(...params).map(toCamel);
  });

  ipcMain.handle('reports:profitBySize', async (_event, filters?: { from?: string; to?: string }) => {
    const db = getDb();
    const from = filters?.from || getLocalDate();
    const to = filters?.to || from;
    return db.prepare(`
      SELECT si.product_name, pr.size, pr.size_unit,
             SUM(si.quantity) as qty, SUM(si.total) as sales,
             SUM(si.cost * si.quantity) as cost,
             SUM(si.total - si.cost * si.quantity) as profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products pr ON pr.id = si.product_id
      WHERE s.date >= ? AND s.date <= ?
      GROUP BY si.product_id, si.product_name, pr.size, pr.size_unit ORDER BY profit DESC
    `).all(from, to).map(toCamel);
  });
}
