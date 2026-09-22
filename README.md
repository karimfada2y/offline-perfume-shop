# محل العطور - Offline Egyptian Perfume Shop

A complete offline desktop POS and business management system for Egyptian perfume shops.

## Features

- **POS System** - Fast barcode scanning, cart management, split payments
- **Products** - Categories, brands, SKU, barcode, multiple price levels
- **Inventory** - Stock ledger, movements, adjustments, low-stock alerts
- **Purchasing** - Purchase invoices, supplier payments, weighted average cost
- **Sales** - Full/ partial returns, credit sales, customer accounts
- **Customers** - Customer management, balances, transaction history
- **Suppliers** - Supplier management, balances, payment tracking
- **Production** - Formulas, raw materials, batch production, cost calculation
- **Expenses** - Category-based expense tracking
- **Cash Register** - Opening/closing sessions, cash movements
- **Accounting** - Double-entry journal entries, trial balance
- **Reports** - Sales, profit, inventory, production reports
- **Dashboard** - Key metrics, charts, alerts
- **Printing** - Thermal receipt and A4 invoice support
- **Backup/Restore** - Automatic and manual database backups
- **Import/Export** - CSV import/export for products and data
- **Arabic RTL** - Full Arabic language support with RTL layout
- **Audit Logging** - Complete audit trail for all operations

## Tech Stack

- Electron
- React + TypeScript
- Vite
- sql.js (SQLite)
- Tailwind CSS
- Zustand

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create Windows installer
npm run package

# Run tests
npm run test

# Type check
npm run typecheck
```

## First Run

1. Launch the application
2. Follow the setup wizard:
   - Choose language (Arabic/English)
   - Enter shop details
   - Create owner account
3. Start using the system

## Default Login

After setup, login with the owner account you created.

## Architecture

```
src/
  main/          - Electron main process
    database/    - SQLite database, migrations, wrapper
    ipc/         - IPC handlers for all features
    security/    - Authentication, password hashing
    backup/      - Backup and restore
    printers/    - Printer integration
  renderer/      - React frontend
    pages/       - All application pages
    components/  - UI components
    stores/      - Zustand state management
    i18n/        - Arabic/English translations
  shared/        - Shared types and constants
```

## License

MIT
