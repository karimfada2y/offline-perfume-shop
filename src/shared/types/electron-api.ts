export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

export interface ElectronAPI {
  // Auth
  login: (username: string, password: string) => Promise<{
    token: string;
    user: { id: number; username: string; displayName: string; roleId: number };
    permissions: string[];
  }>;
  logout: () => Promise<void>;
  changePassword: (userId: number, oldPassword: string, newPassword: string) => Promise<void>;
  getCurrentUser: () => Promise<{ id: number; username: string; displayName: string; roleId: number } | null>;
  createInitialOwner: (data: { username: string; password: string; displayName: string }) => Promise<void>;

  // Licensing
  activateLicense: (key: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  checkActivation: () => Promise<{ activated: boolean; deviceId: string }>;
  notifyActivated: () => void;

  // Products
  getProducts: (filters?: unknown) => Promise<unknown>;
  createProduct: (product: unknown) => Promise<unknown>;
  updateProduct: (id: number, product: unknown) => Promise<unknown>;
  deleteProduct: (id: number) => Promise<void>;
  getProductById: (id: number) => Promise<unknown>;
  searchProducts: (query: string) => Promise<unknown>;
  getProductStats: () => Promise<unknown>;
  getVariants: (parentId: number) => Promise<unknown>;

  // Categories
  getCategories: () => Promise<unknown>;
  createCategory: (cat: unknown) => Promise<unknown>;
  updateCategory: (id: number, cat: unknown) => Promise<unknown>;
  deleteCategory: (id: number) => Promise<void>;

  // Brands
  getBrands: () => Promise<unknown>;
  createBrand: (brand: unknown) => Promise<unknown>;
  updateBrand: (id: number, brand: unknown) => Promise<unknown>;
  deleteBrand: (id: number) => Promise<void>;

  // Inventory
  getInventory: (filters?: unknown) => Promise<unknown>;
  getInventoryMovements: (filters?: unknown) => Promise<unknown>;
  adjustInventory: (data: unknown) => Promise<unknown>;
  getLowStock: () => Promise<unknown>;

  // Customers
  getCustomers: (filters?: unknown) => Promise<unknown>;
  createCustomer: (customer: unknown) => Promise<unknown>;
  updateCustomer: (id: number, customer: unknown) => Promise<unknown>;
  getCustomerAccount: (id: number) => Promise<unknown>;
  getCustomerTransactions: (id: number) => Promise<unknown>;

  // Suppliers
  getSuppliers: (filters?: unknown) => Promise<unknown>;
  createSupplier: (supplier: unknown) => Promise<unknown>;
  updateSupplier: (id: number, supplier: unknown) => Promise<unknown>;
  getSupplierAccount: (id: number) => Promise<unknown>;
  getSupplierTransactions: (id: number) => Promise<unknown>;

  // Purchases
  getPurchases: (filters?: unknown) => Promise<unknown>;
  createPurchase: (purchase: unknown) => Promise<unknown>;
  getPurchaseById: (id: number) => Promise<unknown>;
  paySupplier: (data: unknown) => Promise<unknown>;

  // Sales
  getSales: (filters?: unknown) => Promise<unknown>;
  createSale: (sale: unknown) => Promise<unknown>;
  getSaleById: (id: number) => Promise<unknown>;
  returnSaleItem: (data: unknown) => Promise<unknown>;
  receiveCustomerPayment: (data: unknown) => Promise<unknown>;
  previewRecipe: (items: unknown) => Promise<unknown>;

  // Cash Register
  getCashRegisters: () => Promise<unknown>;
  openCashSession: (data: unknown) => Promise<unknown>;
  closeCashSession: (id: number, data: unknown) => Promise<unknown>;
  getCashMovements: (sessionId: number) => Promise<unknown>;
  getActiveCashSession: () => Promise<unknown>;
  getClosingReport: (sessionId: number) => Promise<unknown>;

  // Expenses
  getExpenses: (filters?: unknown) => Promise<unknown>;
  createExpense: (expense: unknown) => Promise<unknown>;
  deleteExpense: (id: number) => Promise<void>;
  getExpenseCategories: () => Promise<unknown>;

  // Production
  getRawMaterials: (filters?: unknown) => Promise<unknown>;
  createRawMaterial: (material: unknown) => Promise<unknown>;
  updateRawMaterial: (id: number, material: unknown) => Promise<unknown>;
  deleteRawMaterial: (id: number) => Promise<void>;
  getFormulas: (filters?: unknown) => Promise<unknown>;
  getFormulaById: (id: number) => Promise<unknown>;
  createFormula: (formula: unknown) => Promise<unknown>;
  updateFormula: (id: number, formula: unknown) => Promise<unknown>;
  deleteFormula: (id: number) => Promise<void>;
  getProductionBatches: (filters?: unknown) => Promise<unknown>;
  getBatchById: (id: number) => Promise<unknown>;
  createProductionBatch: (batch: unknown) => Promise<unknown>;
  previewProductionBatch: (data: unknown) => Promise<unknown>;

  // Accounting
  getJournalEntries: (filters?: unknown) => Promise<unknown>;
  getAccounts: () => Promise<unknown>;
  getTrialBalance: () => Promise<unknown>;

  // Reports
  getDashboard: () => Promise<unknown>;
  getSalesReport: (filters?: unknown) => Promise<unknown>;
  getProfitReport: (filters?: unknown) => Promise<unknown>;
  getInventoryReport: (filters?: unknown) => Promise<unknown>;
  getProductionReport: (filters?: unknown) => Promise<unknown>;
  getMaterialConsumptionReport: (filters?: unknown) => Promise<unknown>;
  getProfitBySizeReport: (filters?: unknown) => Promise<unknown>;

  // Settings
  getSettings: () => Promise<unknown>;
  updateSettings: (settings: unknown) => Promise<unknown>;
  uploadLogo: (type: string) => Promise<unknown>;
  getBusinessInfo: () => Promise<unknown>;

  // Backup
  createBackup: () => Promise<unknown>;
  restoreBackup: (backupPath: string) => Promise<unknown>;
  listBackups: () => Promise<unknown>;

  // Audit
  getAuditLogs: (filters?: unknown) => Promise<unknown>;

  // Diagnostics
  runDiagnostics: () => Promise<unknown>;

  // Print
  printReceipt: (data: unknown) => Promise<unknown>;
  printInvoice: (data: unknown) => Promise<unknown>;
  getPrinters: () => Promise<unknown>;
  testPrint: (printerName: string) => Promise<unknown>;
  savePDF: (data: { data: number[]; defaultFilename: string }) => Promise<{ success: boolean; filePath?: string }>;

  // Users
  getUsers: () => Promise<unknown>;
  createUser: (user: unknown) => Promise<unknown>;
  updateUser: (id: number, user: unknown) => Promise<unknown>;
  toggleUserActive: (id: number) => Promise<unknown>;

  // Roles
  getRoles: () => Promise<unknown>;
  getPermissions: () => Promise<unknown>;
  updateRolePermissions: (roleId: number, permissions: number[]) => Promise<unknown>;

  // Import/Export
  exportCSV: (type: string, filters?: unknown) => Promise<unknown>;
  importProducts: (filePath: string) => Promise<unknown>;

  // App
  getVersion: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  isFirstRun: () => Promise<boolean>;
  completeSetup: () => Promise<void>;

  // Store Settings
  getStoreSettings: () => Promise<{
    id: number;
    store_name: string;
    owner_name: string;
    phone1: string;
    phone2: string;
    address: string;
    city: string;
    tax_number: string;
    commercial_number: string;
    logo_path: string;
    currency: string;
    show_logo: number;
    show_phone: number;
    show_address: number;
    show_tax_number: number;
    show_commercial_number: number;
    receipt_width: string;
    invoice_footer: string;
    receipt_name: string;
    invoice_name: string;
    receipt_subtitle: string;
    invoice_subtitle: string;
    receipt_footer: string;
  }>;
  updateStoreSettings: (data: Record<string, unknown>) => Promise<unknown>;
  uploadStoreLogo: (buffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  removeStoreLogo: () => Promise<{ success: boolean }>;

  // Updater
  checkForUpdates: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
