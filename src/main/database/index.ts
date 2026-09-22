import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { runMigrations } from './migrations';
import { app } from 'electron';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';
let sqlFactory: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export function getDatabase(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getDbPath(): string {
  return dbPath;
}

function getWasmPath(): string {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    return path.join(process.resourcesPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  return path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
}

export async function initializeDatabase(databasePath: string): Promise<void> {
  dbPath = databasePath;
  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const wasmPath = getWasmPath();
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });
  sqlFactory = SQL;

  if (fs.existsSync(databasePath)) {
    const buffer = fs.readFileSync(databasePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = WAL;');

  runMigrations(db);
  seedDefaultData(db);
  seedDefaultUser(db);
  saveDatabase();
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function reloadDatabase(): void {
  if (!dbPath || !fs.existsSync(dbPath) || !sqlFactory) return;
  if (db) db.close();
  const buffer = fs.readFileSync(dbPath);
  db = new sqlFactory.Database(buffer);
  db.run('PRAGMA foreign_keys = ON;');
}

function seedDefaultData(database: SqlJsDatabase): void {
  const result = database.exec('SELECT COUNT(*) as count FROM roles');
  const count = result[0]?.values[0]?.[0] as number || 0;
  if (count > 0) return;

  const now = new Date().toISOString();
  const roles = [
    ['owner', 'المالك', 'Owner', 1],
    ['manager', 'المدير', 'Manager', 1],
    ['cashier', 'أمين الصندوق', 'Cashier', 1],
    ['inventory_manager', 'مدير المخزون', 'Inventory Manager', 1],
    ['production_manager', 'مدير الإنتاج', 'Production Manager', 1],
    ['accountant', 'المحاسب', 'Accountant', 1],
  ];

  const insertRole = database.prepare('INSERT INTO roles (name, display_name_ar, display_name_en, is_system, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const r of roles) {
    insertRole.run([r[0], r[1], r[2], r[3], now]);
  }
  insertRole.free();

  seedPermissions(database);
  seedDefaultAccounts(database);
  seedDefaultExpenseCategories(database);
  seedDefaultCashRegister(database);
}

function seedPermissions(database: SqlJsDatabase): void {
  const perms: [string, string, string, string][] = [
    ['view_dashboard', 'عرض لوحة التحكم', 'View Dashboard', 'dashboard'],
    ['create_sale', 'إنشاء بيع', 'Create Sale', 'sales'],
    ['edit_sale', 'تعديل بيع', 'Edit Sale', 'sales'],
    ['cancel_sale', 'إلغاء بيع', 'Cancel Sale', 'sales'],
    ['refund_sale', 'استرداد بيع', 'Refund Sale', 'sales'],
    ['view_sales', 'عرض المبيعات', 'View Sales', 'sales'],
    ['create_product', 'إنشاء منتج', 'Create Product', 'products'],
    ['edit_product', 'تعديل منتج', 'Edit Product', 'products'],
    ['delete_product', 'حذف منتج', 'Delete Product', 'products'],
    ['view_products', 'عرض المنتجات', 'View Products', 'products'],
    ['create_purchase', 'إنشاء مشتريات', 'Create Purchase', 'purchases'],
    ['edit_purchase', 'تعديل مشتريات', 'Edit Purchase', 'purchases'],
    ['delete_purchase', 'حذف مشتريات', 'Delete Purchase', 'purchases'],
    ['view_purchases', 'عرض المشتريات', 'View Purchases', 'purchases'],
    ['adjust_inventory', 'تعديل المخزون', 'Adjust Inventory', 'inventory'],
    ['view_inventory', 'عرض المخزون', 'View Inventory', 'inventory'],
    ['view_costs', 'عرض التكاليف', 'View Costs', 'inventory'],
    ['create_formula', 'إنشاء صيغة', 'Create Formula', 'production'],
    ['edit_formula', 'تعديل صيغة', 'Edit Formula', 'production'],
    ['delete_formula', 'حذف صيغة', 'Delete Formula', 'production'],
    ['produce_batch', 'إنتاج دفعة', 'Produce Batch', 'production'],
    ['view_customers', 'عرض العملاء', 'View Customers', 'customers'],
    ['edit_customers', 'تعديل العملاء', 'Edit Customers', 'customers'],
    ['view_suppliers', 'عرض الموردين', 'View Suppliers', 'suppliers'],
    ['edit_suppliers', 'تعديل الموردين', 'Edit Suppliers', 'suppliers'],
    ['create_expense', 'إنشاء مصروف', 'Create Expense', 'expenses'],
    ['delete_expense', 'حذف مصروف', 'Delete Expense', 'expenses'],
    ['view_reports', 'عرض التقارير', 'View Reports', 'reports'],
    ['view_profit', 'عرض الأرباح', 'View Profit', 'reports'],
    ['manage_users', 'إدارة المستخدمين', 'Manage Users', 'settings'],
    ['manage_settings', 'إدارة الإعدادات', 'Manage Settings', 'settings'],
    ['backup_database', 'نسخ احتياطي', 'Backup Database', 'settings'],
    ['restore_database', 'استعادة النسخة الاحتياطية', 'Restore Database', 'settings'],
  ];

  const insertPerm = database.prepare('INSERT INTO permissions (name, display_name_ar, display_name_en, category) VALUES (?, ?, ?, ?)');
  for (const p of perms) {
    insertPerm.run([p[0], p[1], p[2], p[3]]);
  }
  insertPerm.free();

  const ownerRole = database.exec('SELECT id FROM roles WHERE name = "owner"');
  const ownerId = ownerRole[0]?.values[0]?.[0] as number;
  const allPerms = database.exec('SELECT id FROM permissions');

  const insertRP = database.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const row of allPerms[0]?.values || []) {
    insertRP.run([ownerId, row[0]]);
  }
  insertRP.free();
}

function seedDefaultAccounts(database: SqlJsDatabase): void {
  const count = database.exec('SELECT COUNT(*) as count FROM accounts');
  if ((count[0]?.values[0]?.[0] as number || 0) > 0) return;

  const accounts: [string, string, string, string][] = [
    ['1000', 'الصندوق', 'Cash', 'asset'],
    ['1010', 'البنك / البطاقة', 'Bank/Card', 'asset'],
    ['1020', 'المبالغ المستحقة من العملاء', 'Customer Receivables', 'asset'],
    ['1030', 'المخزون', 'Inventory', 'asset'],
    ['2000', 'المبالغ المستحقة للموردين', 'Supplier Payables', 'liability'],
    ['3000', 'حقوق المالك', 'Owner Equity', 'equity'],
    ['4000', 'إيرادات المبيعات', 'Sales Revenue', 'revenue'],
    ['5000', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', 'expense'],
    ['6000', 'المصروفات التشغيلية', 'Operating Expenses', 'expense'],
  ];

  const insert = database.prepare('INSERT INTO accounts (code, name_ar, name_en, type, active) VALUES (?, ?, ?, ?, 1)');
  for (const a of accounts) {
    insert.run([a[0], a[1], a[2], a[3]]);
  }
  insert.free();
}

function seedDefaultExpenseCategories(database: SqlJsDatabase): void {
  const count = database.exec('SELECT COUNT(*) as count FROM expense_categories');
  if ((count[0]?.values[0]?.[0] as number || 0) > 0) return;

  const cats: [string, string][] = [
    ['الإيجار', 'Rent'],
    ['كهرباء', 'Electricity'],
    ['مياه', 'Water'],
    ['إنترنت', 'Internet'],
    ['الرواتب', 'Salaries'],
    ['التغليف', 'Packaging'],
    ['النقل', 'Transportation'],
    ['التوصيل', 'Delivery'],
    ['التسويق', 'Marketing'],
    ['الصيانة', 'Maintenance'],
    ['أخرى', 'Other'],
  ];

  const insert = database.prepare('INSERT INTO expense_categories (name_ar, name_en, active) VALUES (?, ?, 1)');
  for (const c of cats) {
    insert.run([c[0], c[1]]);
  }
  insert.free();
}

function seedDefaultCashRegister(database: SqlJsDatabase): void {
  const count = database.exec('SELECT COUNT(*) as count FROM cash_registers');
  if ((count[0]?.values[0]?.[0] as number || 0) > 0) return;

  const now = new Date().toISOString();
  database.run('INSERT INTO cash_registers (name, active, created_at) VALUES (?, 1, ?)', ['الصندوق الرئيسي', now]);
  database.run('INSERT INTO cash_registers (name, active, created_at) VALUES (?, 1, ?)', ['صندوق الفرع', now]);
}

function seedDefaultUser(database: SqlJsDatabase): void {
  const userCount = database.exec('SELECT COUNT(*) as count FROM users');
  if ((userCount[0]?.values[0]?.[0] as number || 0) > 0) return;

  const ownerRole = database.exec('SELECT id FROM roles WHERE name = "owner"');
  const ownerId = ownerRole[0]?.values[0]?.[0] as number;
  if (!ownerId) return;

  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync('admin123', salt, 100000, 64, 'sha512');
  const passwordHash = `${salt}:${hash.toString('hex')}`;
  const now = new Date().toISOString();

  database.run(
    'INSERT INTO users (username, display_name, password_hash, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    ['admin', 'المالك', passwordHash, ownerId, now, now]
  );

  const bizCount = database.exec('SELECT COUNT(*) as count FROM business');
  if ((bizCount[0]?.values[0]?.[0] as number || 0) === 0) {
    database.run(
      'INSERT INTO business (name_ar, name_en, created_at, updated_at, setup_complete) VALUES (?, ?, ?, ?, 1)',
      ['محل العطور', 'Perfume Shop', now, now]
    );
  } else {
    database.run('UPDATE business SET setup_complete = 1, updated_at = ? WHERE id = 1', [now]);
  }
}
