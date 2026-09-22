import { contextBridge, ipcRenderer } from 'electron';

let sessionToken: string | null = null;

function setSessionToken(token: string | null) {
  sessionToken = token;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: async (username: string, password: string) => {
    const result = await ipcRenderer.invoke('auth:login', username, password);
    if (result && result.token) {
      setSessionToken(result.token);
    }
    return result;
  },
  logout: () => {
    const token = sessionToken;
    setSessionToken(null);
    return ipcRenderer.invoke('auth:logout', token);
  },
  changePassword: (userId: number, oldPassword: string, newPassword: string) =>
    ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword, sessionToken),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser', sessionToken),
  createInitialOwner: (data: { username: string; password: string; displayName: string }) =>
    ipcRenderer.invoke('auth:createInitialOwner', data),

  // Products
  getProducts: (filters?: unknown) => ipcRenderer.invoke('products:list', filters),
  createProduct: (product: unknown) => ipcRenderer.invoke('products:create', product),
  updateProduct: (id: number, product: unknown) => ipcRenderer.invoke('products:update', id, product),
  deleteProduct: (id: number) => ipcRenderer.invoke('products:delete', id),
  getProductById: (id: number) => ipcRenderer.invoke('products:getById', id),
  searchProducts: (query: string) => ipcRenderer.invoke('products:search', query),
  getProductStats: () => ipcRenderer.invoke('products:stats'),
  getVariants: (parentId: number) => ipcRenderer.invoke('products:getVariants', parentId),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (cat: unknown) => ipcRenderer.invoke('categories:create', cat),
  updateCategory: (id: number, cat: unknown) => ipcRenderer.invoke('categories:update', id, cat),
  deleteCategory: (id: number) => ipcRenderer.invoke('categories:delete', id),

  // Brands
  getBrands: () => ipcRenderer.invoke('brands:list'),
  createBrand: (brand: unknown) => ipcRenderer.invoke('brands:create', brand),
  updateBrand: (id: number, brand: unknown) => ipcRenderer.invoke('brands:update', id, brand),
  deleteBrand: (id: number) => ipcRenderer.invoke('brands:delete', id),

  // Inventory
  getInventory: (filters?: unknown) => ipcRenderer.invoke('inventory:list', filters),
  getInventoryMovements: (filters?: unknown) => ipcRenderer.invoke('inventory:movements', filters),
  adjustInventory: (data: unknown) => ipcRenderer.invoke('inventory:adjust', data),
  getLowStock: () => ipcRenderer.invoke('inventory:lowStock'),

  // Customers
  getCustomers: (filters?: unknown) => ipcRenderer.invoke('customers:list', filters),
  createCustomer: (customer: unknown) => ipcRenderer.invoke('customers:create', customer),
  updateCustomer: (id: number, customer: unknown) => ipcRenderer.invoke('customers:update', id, customer),
  getCustomerAccount: (id: number) => ipcRenderer.invoke('customers:getAccount', id),
  getCustomerTransactions: (id: number) => ipcRenderer.invoke('customers:getTransactions', id),

  // Suppliers
  getSuppliers: (filters?: unknown) => ipcRenderer.invoke('suppliers:list', filters),
  createSupplier: (supplier: unknown) => ipcRenderer.invoke('suppliers:create', supplier),
  updateSupplier: (id: number, supplier: unknown) => ipcRenderer.invoke('suppliers:update', id, supplier),
  getSupplierAccount: (id: number) => ipcRenderer.invoke('suppliers:getAccount', id),
  getSupplierTransactions: (id: number) => ipcRenderer.invoke('suppliers:getTransactions', id),

  // Purchases
  getPurchases: (filters?: unknown) => ipcRenderer.invoke('purchases:list', filters),
  createPurchase: (purchase: unknown) => ipcRenderer.invoke('purchases:create', purchase),
  getPurchaseById: (id: number) => ipcRenderer.invoke('purchases:getById', id),
  paySupplier: (data: unknown) => ipcRenderer.invoke('purchases:paySupplier', data),

  // Sales
  getSales: (filters?: unknown) => ipcRenderer.invoke('sales:list', filters),
  createSale: (sale: unknown) => ipcRenderer.invoke('sales:create', sale),
  getSaleById: (id: number) => ipcRenderer.invoke('sales:getById', id),
  returnSaleItem: (data: unknown) => ipcRenderer.invoke('sales:returnItem', data),
  receiveCustomerPayment: (data: unknown) => ipcRenderer.invoke('sales:receivePayment', data),
  previewRecipe: (items: unknown) => ipcRenderer.invoke('sales:previewRecipe', items),

  // Cash Register
  getCashRegisters: () => ipcRenderer.invoke('cash:listRegisters'),
  openCashSession: (data: unknown) => ipcRenderer.invoke('cash:openSession', data),
  closeCashSession: (id: number, data: unknown) => ipcRenderer.invoke('cash:closeSession', id, data),
  getCashMovements: (sessionId: number) => ipcRenderer.invoke('cash:getMovements', sessionId),
  getActiveCashSession: () => ipcRenderer.invoke('cash:getActiveSession'),
  getClosingReport: (sessionId: number) => ipcRenderer.invoke('cash:getClosingReport', sessionId),

  // Expenses
  getExpenses: (filters?: unknown) => ipcRenderer.invoke('expenses:list', filters),
  createExpense: (expense: unknown) => ipcRenderer.invoke('expenses:create', expense),
  deleteExpense: (id: number) => ipcRenderer.invoke('expenses:delete', id),
  getExpenseCategories: () => ipcRenderer.invoke('expenses:categories'),

  // Production
  getRawMaterials: (filters?: unknown) => ipcRenderer.invoke('production:listRawMaterials', filters),
  createRawMaterial: (material: unknown) => ipcRenderer.invoke('production:createRawMaterial', material),
  updateRawMaterial: (id: number, material: unknown) => ipcRenderer.invoke('production:updateRawMaterial', id, material),
  deleteRawMaterial: (id: number) => ipcRenderer.invoke('production:deleteRawMaterial', id),
  getFormulas: (filters?: unknown) => ipcRenderer.invoke('production:listFormulas', filters),
  getFormulaById: (id: number) => ipcRenderer.invoke('production:getFormulaById', id),
  createFormula: (formula: unknown) => ipcRenderer.invoke('production:createFormula', formula),
  updateFormula: (id: number, formula: unknown) => ipcRenderer.invoke('production:updateFormula', id, formula),
  deleteFormula: (id: number) => ipcRenderer.invoke('production:deleteFormula', id),
  getProductionBatches: (filters?: unknown) => ipcRenderer.invoke('production:listBatches', filters),
  getBatchById: (id: number) => ipcRenderer.invoke('production:getBatchById', id),
  createProductionBatch: (batch: unknown) => ipcRenderer.invoke('production:createBatch', batch),
  previewProductionBatch: (data: unknown) => ipcRenderer.invoke('production:previewBatch', data),

  // Accounting
  getJournalEntries: (filters?: unknown) => ipcRenderer.invoke('accounting:listEntries', filters),
  getAccounts: () => ipcRenderer.invoke('accounting:listAccounts'),
  getTrialBalance: () => ipcRenderer.invoke('accounting:trialBalance'),

  // Reports
  getDashboard: () => ipcRenderer.invoke('reports:dashboard'),
  getSalesReport: (filters?: unknown) => ipcRenderer.invoke('reports:sales', filters),
  getProfitReport: (filters?: unknown) => ipcRenderer.invoke('reports:profit', filters),
  getInventoryReport: (filters?: unknown) => ipcRenderer.invoke('reports:inventory', filters),
  getProductionReport: (filters?: unknown) => ipcRenderer.invoke('reports:production', filters),
  getMaterialConsumptionReport: (filters?: unknown) => ipcRenderer.invoke('reports:materialConsumption', filters),
  getProfitBySizeReport: (filters?: unknown) => ipcRenderer.invoke('reports:profitBySize', filters),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: unknown) => ipcRenderer.invoke('settings:update', settings),
  uploadLogo: (type: string) => ipcRenderer.invoke('settings:uploadLogo', type),
  getBusinessInfo: () => ipcRenderer.invoke('settings:getBusinessInfo'),

  // Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
  listBackups: () => ipcRenderer.invoke('backup:list'),

  // Audit
  getAuditLogs: (filters?: unknown) => ipcRenderer.invoke('audit:list', filters),

  // Diagnostics
  runDiagnostics: () => ipcRenderer.invoke('diagnostics:run'),

  // Print
  printReceipt: (data: unknown) => ipcRenderer.invoke('print:receipt', data),
  printInvoice: (data: unknown) => ipcRenderer.invoke('print:invoice', data),
  getPrinters: () => ipcRenderer.invoke('print:getPrinters'),
  testPrint: (printerName: string) => ipcRenderer.invoke('print:test', printerName),
  savePDF: (data: { data: number[]; defaultFilename: string }) => ipcRenderer.invoke('print:savePDF', data),

  // Users (protected)
  getUsers: () => ipcRenderer.invoke('users:list', sessionToken),
  createUser: (user: unknown) => ipcRenderer.invoke('users:create', user, sessionToken),
  updateUser: (id: number, user: unknown) => ipcRenderer.invoke('users:update', id, user, sessionToken),
  toggleUserActive: (id: number) => ipcRenderer.invoke('users:toggleActive', id, sessionToken),

  // Roles (protected)
  getRoles: () => ipcRenderer.invoke('roles:list'),
  getPermissions: () => ipcRenderer.invoke('roles:getPermissions'),
  updateRolePermissions: (roleId: number, permissions: number[]) =>
    ipcRenderer.invoke('roles:updatePermissions', roleId, permissions, sessionToken),

  // Import/Export
  exportCSV: (type: string, filters?: unknown) => ipcRenderer.invoke('export:csv', type, filters),
  importProducts: (filePath: string) => ipcRenderer.invoke('import:products', filePath),

  // Licensing
  activateLicense: (licenseKey: string) => ipcRenderer.invoke('licensing:activate', licenseKey),
  checkActivation: () => ipcRenderer.invoke('licensing:checkActivation'),
  notifyActivated: () => ipcRenderer.send('licensing:activated'),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
  completeSetup: () => ipcRenderer.invoke('app:completeSetup'),

  // Store Settings
  getStoreSettings: () => ipcRenderer.invoke('storeSettings:get'),
  updateStoreSettings: (data: unknown) => ipcRenderer.invoke('storeSettings:update', data),
  uploadStoreLogo: (buffer: ArrayBuffer, fileName: string) => ipcRenderer.invoke('storeSettings:uploadLogo', buffer, fileName),
  removeStoreLogo: () => ipcRenderer.invoke('storeSettings:removeLogo'),
});
