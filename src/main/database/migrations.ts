import { Database as SqlJsDatabase } from 'sql.js';

export function runMigrations(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = db.exec('SELECT name FROM migrations');
  const appliedSet = new Set((applied[0]?.values || []).map(r => r[0] as string));

  const migrations = getMigrations();

  for (const migration of migrations) {
    if (!appliedSet.has(migration.name)) {
      db.run(migration.sql);
      db.run('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [migration.name, new Date().toISOString()]);
    }
  }
}

function getMigrations(): { name: string; sql: string }[] {
  return [
    {
      name: '001_enable_foreign_keys',
      sql: `PRAGMA foreign_keys = ON;`,
    },
    {
      name: '002_core_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS business (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL DEFAULT '',
          name_en TEXT NOT NULL DEFAULT '',
          address TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          whatsapp TEXT DEFAULT '',
          tax_number TEXT DEFAULT '',
          currency TEXT NOT NULL DEFAULT 'EGP',
          currency_symbol TEXT NOT NULL DEFAULT 'ج.م',
          logo_path TEXT,
          setup_complete INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          display_name_ar TEXT NOT NULL,
          display_name_en TEXT NOT NULL,
          is_system INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          display_name_ar TEXT NOT NULL,
          display_name_en TEXT NOT NULL,
          category TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role_id INTEGER NOT NULL REFERENCES roles(id),
          permission_id INTEGER NOT NULL REFERENCES permissions(id),
          UNIQUE(role_id, permission_id)
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role_id INTEGER NOT NULL REFERENCES roles(id),
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          token TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          updated_at TEXT NOT NULL
        );
      `,
    },
    {
      name: '003_product_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          description TEXT,
          parent_id INTEGER,
          active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS brands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          description TEXT,
          logo_path TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT NOT NULL UNIQUE,
          barcode TEXT,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          description TEXT,
          category_id INTEGER REFERENCES categories(id),
          brand_id INTEGER REFERENCES brands(id),
          unit TEXT NOT NULL DEFAULT 'piece',
          size REAL,
          size_unit TEXT,
          cost REAL NOT NULL DEFAULT 0,
          weighted_avg_cost REAL NOT NULL DEFAULT 0,
          retail_price REAL NOT NULL DEFAULT 0,
          wholesale_price REAL NOT NULL DEFAULT 0,
          minimum_price REAL NOT NULL DEFAULT 0,
          minimum_stock REAL NOT NULL DEFAULT 0,
          current_stock REAL NOT NULL DEFAULT 0,
          product_type TEXT NOT NULL DEFAULT 'finished_perfume',
          sellable INTEGER NOT NULL DEFAULT 1,
          purchasable INTEGER NOT NULL DEFAULT 1,
          consumable INTEGER NOT NULL DEFAULT 0,
          producible INTEGER NOT NULL DEFAULT 1,
          inventory_tracked INTEGER NOT NULL DEFAULT 1,
          image_path TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_products_name_ar ON products(name_ar);
        CREATE INDEX IF NOT EXISTS idx_products_name_en ON products(name_en);
      `,
    },
    {
      name: '004_customer_supplier_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT,
          phone TEXT,
          whatsapp TEXT,
          address TEXT,
          email TEXT,
          notes TEXT,
          opening_balance REAL NOT NULL DEFAULT 0,
          current_balance REAL NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customer_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          balance_after REAL NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          description TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS suppliers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT,
          phone TEXT,
          whatsapp TEXT,
          address TEXT,
          notes TEXT,
          opening_balance REAL NOT NULL DEFAULT 0,
          current_balance REAL NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS supplier_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          balance_after REAL NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          description TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_customers_name_ar ON customers(name_ar);
        CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
        CREATE INDEX IF NOT EXISTS idx_suppliers_name_ar ON suppliers(name_ar);
      `,
    },
    {
      name: '005_purchase_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS purchase_invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT NOT NULL UNIQUE,
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
          date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          discount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          paid REAL NOT NULL DEFAULT 0,
          remaining REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS purchase_invoice_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
          product_id INTEGER NOT NULL REFERENCES products(id),
          quantity REAL NOT NULL,
          unit_cost REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS purchase_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
          amount REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          date TEXT NOT NULL,
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );
      `,
    },
    {
      name: '006_sales_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT NOT NULL UNIQUE,
          customer_id INTEGER REFERENCES customers(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          discount REAL NOT NULL DEFAULT 0,
          tax_rate REAL NOT NULL DEFAULT 0,
          tax_amount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          paid REAL NOT NULL DEFAULT 0,
          remaining REAL NOT NULL DEFAULT 0,
          payment_status TEXT NOT NULL DEFAULT 'paid',
          payment_method TEXT NOT NULL DEFAULT 'cash',
          cash_session_id INTEGER,
          notes TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL REFERENCES sales(id),
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          cost REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sale_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_number TEXT NOT NULL UNIQUE,
          original_sale_id INTEGER NOT NULL REFERENCES sales(id),
          customer_id INTEGER REFERENCES customers(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          refund_amount REAL NOT NULL DEFAULT 0,
          refund_method TEXT NOT NULL DEFAULT 'cash',
          reason TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sale_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_return_id INTEGER NOT NULL REFERENCES sale_returns(id),
          sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          cost REAL NOT NULL,
          total REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
        CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
      `,
    },
    {
      name: '007_cash_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS cash_registers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cash_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          register_id INTEGER NOT NULL REFERENCES cash_registers(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          opening_cash REAL NOT NULL DEFAULT 0,
          closing_cash REAL,
          expected_cash REAL,
          difference REAL,
          status TEXT NOT NULL DEFAULT 'open',
          opened_at TEXT NOT NULL,
          closed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS cash_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          reference_type TEXT,
          reference_id INTEGER,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );
      `,
    },
    {
      name: '008_expense_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS expense_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL REFERENCES expense_categories(id),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          description TEXT,
          cash_session_id INTEGER,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );
      `,
    },
    {
      name: '009_production_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS raw_materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER REFERENCES products(id),
          unit TEXT NOT NULL DEFAULT 'ml',
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS formulas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          target_product_id INTEGER REFERENCES products(id),
          batch_size REAL NOT NULL,
          batch_unit TEXT NOT NULL DEFAULT 'ml',
          notes TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS formula_components (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          formula_id INTEGER NOT NULL REFERENCES formulas(id),
          raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
          quantity REAL NOT NULL,
          percentage REAL,
          sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS production_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_number TEXT NOT NULL UNIQUE,
          formula_id INTEGER NOT NULL REFERENCES formulas(id),
          target_product_id INTEGER REFERENCES products(id),
          quantity_planned REAL NOT NULL,
          quantity_produced REAL NOT NULL DEFAULT 0,
          wastage REAL NOT NULL DEFAULT 0,
          total_cost REAL NOT NULL DEFAULT 0,
          cost_per_unit REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'planned',
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS production_batch_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id INTEGER NOT NULL REFERENCES production_batches(id),
          raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
          product_id INTEGER REFERENCES products(id),
          quantity_required REAL NOT NULL,
          quantity_used REAL NOT NULL DEFAULT 0,
          unit_cost REAL NOT NULL DEFAULT 0,
          total_cost REAL NOT NULL DEFAULT 0
        );
      `,
    },
    {
      name: '010_inventory_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id),
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          before_quantity REAL NOT NULL,
          after_quantity REAL NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          reason TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(type);
        CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_movements(created_at);
      `,
    },
    {
      name: '011_accounting_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          type TEXT NOT NULL,
          parent_id INTEGER,
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS journal_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_number TEXT NOT NULL UNIQUE,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS journal_entry_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
          account_id INTEGER NOT NULL REFERENCES accounts(id),
          debit REAL NOT NULL DEFAULT 0,
          credit REAL NOT NULL DEFAULT 0,
          description TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
        CREATE INDEX IF NOT EXISTS idx_journal_ref ON journal_entries(reference_type, reference_id);
      `,
    },
    {
      name: '012_audit_table',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id INTEGER,
          details TEXT,
          ip_address TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);
        CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
      `,
    },
    {
      name: '013_product_item_codes',
      sql: `
        ALTER TABLE products ADD COLUMN item_code TEXT;
        ALTER TABLE products ADD COLUMN item_code_2 TEXT;
        CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
        CREATE INDEX IF NOT EXISTS idx_products_item_code_2 ON products(item_code_2);
      `,
    },
    {
      name: '014_business_extended',
      sql: `
        ALTER TABLE business ADD COLUMN address_ar TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN address_en TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN email TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN commercial_registration TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN footer_ar TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN footer_en TEXT DEFAULT '';
        ALTER TABLE business ADD COLUMN invoice_logo_path TEXT;
      `,
    },
    {
      name: '015_formula_bottle_size',
      sql: `
        ALTER TABLE formulas ADD COLUMN bottle_product_id INTEGER REFERENCES products(id);
        ALTER TABLE formulas ADD COLUMN bottle_size REAL;
        ALTER TABLE formulas ADD COLUMN bottle_size_unit TEXT DEFAULT 'ml';
        ALTER TABLE formulas ADD COLUMN target_product_type TEXT DEFAULT 'finished_perfume';
        ALTER TABLE formula_components ADD COLUMN component_type TEXT DEFAULT 'raw_material';
      `,
    },
    {
      name: '016_inventory_movements_cost',
      sql: `
        ALTER TABLE inventory_movements ADD COLUMN unit_cost REAL DEFAULT 0;
        ALTER TABLE inventory_movements ADD COLUMN total_cost REAL DEFAULT 0;
      `,
    },
    {
      name: '017_production_batch_bottle',
      sql: `
        ALTER TABLE production_batches ADD COLUMN bottle_product_id INTEGER REFERENCES products(id);
        ALTER TABLE production_batches ADD COLUMN bottle_size REAL;
        ALTER TABLE production_batches ADD COLUMN bottle_size_unit TEXT DEFAULT 'ml';
      `,
    },
    {
      name: '018_store_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS store_settings (
          id INTEGER PRIMARY KEY,
          store_name TEXT DEFAULT '',
          owner_name TEXT DEFAULT '',
          phone1 TEXT DEFAULT '',
          phone2 TEXT DEFAULT '',
          address TEXT DEFAULT '',
          city TEXT DEFAULT '',
          tax_number TEXT DEFAULT '',
          commercial_number TEXT DEFAULT '',
          logo_path TEXT DEFAULT '',
          currency TEXT DEFAULT 'EGP',
          show_logo INTEGER DEFAULT 1,
          show_phone INTEGER DEFAULT 1,
          show_address INTEGER DEFAULT 1,
          show_tax_number INTEGER DEFAULT 1,
          show_commercial_number INTEGER DEFAULT 1,
          receipt_width TEXT DEFAULT '80mm',
          invoice_footer TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO store_settings (id) VALUES (1);
      `,
    },
    {
      name: '019_print_branding',
      sql: `
        ALTER TABLE store_settings ADD COLUMN receipt_name TEXT DEFAULT '';
        ALTER TABLE store_settings ADD COLUMN invoice_name TEXT DEFAULT '';
        ALTER TABLE store_settings ADD COLUMN receipt_subtitle TEXT DEFAULT '';
        ALTER TABLE store_settings ADD COLUMN invoice_subtitle TEXT DEFAULT '';
        ALTER TABLE store_settings ADD COLUMN receipt_footer TEXT DEFAULT '';
      `,
    },
    {
      name: '020_recipe_at_sale',
      sql: `
        ALTER TABLE products ADD COLUMN inventory_tracking_mode TEXT NOT NULL DEFAULT 'finished_stock';
        CREATE INDEX IF NOT EXISTS idx_products_tracking_mode ON products(inventory_tracking_mode);
      `,
    },
    {
      name: '021_sale_payments',
      sql: `
        CREATE TABLE IF NOT EXISTS sale_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          notes TEXT,
          created_by INTEGER,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
      `,
    },
    {
      name: '022_product_variants',
      sql: `
        ALTER TABLE products ADD COLUMN parent_product_id INTEGER REFERENCES products(id);
        CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);
      `,
    },
  ];
}
