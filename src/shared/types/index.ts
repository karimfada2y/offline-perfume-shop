export interface User {
  id: number;
  username: string;
  displayName: string;
  roleId: number;
  active: boolean;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  itemCode: string | null;
  itemCode2: string | null;
  nameAr: string;
  nameEn: string;
  description: string | null;
  categoryId: number | null;
  brandId: number | null;
  unit: string;
  size: number | null;
  sizeUnit: string | null;
  cost: number;
  weightedAvgCost: number;
  retailPrice: number;
  wholesalePrice: number;
  minimumPrice: number;
  minimumStock: number;
  currentStock: number;
  productType: string;
  sellable: boolean;
  purchasable: boolean;
  consumable: boolean;
  producible: boolean;
  inventoryTracked: boolean;
  inventoryTrackingMode: 'finished_stock' | 'recipe_consumption';
  parentProductId: number | null;
  imagePath: string | null;
  active: boolean;
  category_name?: string;
  brand_name?: string;
  item_code?: string | null;
  item_code_2?: string | null;
  variants?: Product[];
}

export interface Category {
  id: number;
  nameAr: string;
  nameEn: string;
  description: string | null;
  parentId: number | null;
  active: boolean;
  sortOrder: number;
}

export interface Brand {
  id: number;
  nameAr: string;
  nameEn: string;
  description: string | null;
  logoPath: string | null;
  active: boolean;
}

export interface Customer {
  id: number;
  nameAr: string;
  nameEn: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  email: string | null;
  notes: string | null;
  openingBalance: number;
  currentBalance: number;
  active: boolean;
}

export interface Supplier {
  id: number;
  nameAr: string;
  nameEn: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  currentBalance: number;
  active: boolean;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  userId: number;
  date: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
  remaining: number;
  paymentStatus: string;
  paymentMethod: string;
  cashSessionId: number | null;
  notes: string | null;
  customer_name?: string;
  user_name?: string;
  items?: SaleItem[];
  created_at?: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  discount: number;
  total: number;
}

export interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  notes: string | null;
  supplier_name?: string;
  items?: PurchaseInvoiceItem[];
}

export interface PurchaseInvoiceItem {
  id: number;
  purchaseInvoiceId: number;
  productId: number;
  quantity: number;
  unitCost: number;
  discount: number;
  total: number;
  product_name?: string;
}

export interface CashSession {
  id: number;
  registerId: number;
  userId: number;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  register_name?: string;
  user_name?: string;
}

export interface CashMovement {
  id: number;
  sessionId: number;
  type: string;
  amount: number;
  description: string | null;
  referenceType: string | null;
  referenceId: number | null;
  user_name?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  categoryId: number;
  amount: number;
  date: string;
  paymentMethod: string;
  description: string | null;
  cashSessionId: number | null;
  category_name?: string;
  user_name?: string;
}

export interface Formula {
  id: number;
  nameAr: string;
  nameEn: string;
  targetProductId: number | null;
  batchSize: number;
  batchUnit: string;
  bottleProductId: number | null;
  bottleSize: number | null;
  bottleSizeUnit: string | null;
  targetProductType: string;
  notes: string | null;
  active: boolean;
  components?: FormulaComponent[];
  target_product_name?: string;
  bottle_product_name?: string;
}

export interface FormulaComponent {
  id: number;
  formulaId: number;
  rawMaterialId: number;
  quantity: number;
  percentage: number | null;
  componentType: string;
  material_name?: string;
  material_sku?: string;
  material_stock?: number;
  material_unit_cost?: number;
  component_product_id?: number;
}

export interface ProductionBatch {
  id: number;
  batchNumber: string;
  formulaId: number;
  targetProductId: number | null;
  bottleProductId: number | null;
  bottleSize: number | null;
  bottleSizeUnit: string | null;
  quantityPlanned: number;
  quantityProduced: number;
  wastage: number;
  totalCost: number;
  costPerUnit: number;
  status: string;
  notes: string | null;
  formula_name?: string;
  product_name?: string;
  bottle_product_name?: string;
  user_name?: string;
  created_at?: string;
  items?: ProductionBatchItem[];
}

export interface ProductionBatchItem {
  id: number;
  batchId: number;
  rawMaterialId: number;
  productId: number | null;
  quantityRequired: number;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  material_name?: string;
  material_sku?: string;
}

export interface InventoryMovement {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitCost: number;
  totalCost: number;
  referenceType: string | null;
  referenceId: number | null;
  reason: string | null;
  product_name?: string;
  sku?: string;
  item_code?: string;
  user_name?: string;
  created_at: string;
}

export interface Business {
  id: number;
  nameAr: string;
  nameEn: string;
  address: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  whatsapp: string;
  taxNumber: string;
  email: string;
  commercialRegistration: string;
  currency: string;
  currencySymbol: string;
  logoPath: string | null;
  invoiceLogoPath: string | null;
  footerAr: string;
  footerEn: string;
  setupComplete: boolean;
}

export interface InventorySummary {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalCategories: number;
  totalBrands: number;
  byType: Array<{ product_type: string; count: number; value: number }>;
}

export interface DashboardData {
  todaySales: number;
  todayProfit: number;
  todayOrders: number;
  monthSales: number;
  monthProfit: number;
  monthOrders: number;
  monthExpenses: number;
  monthNetProfit: number;
  lowStock: Product[];
  topProducts: Array<{ product_name: string; total_qty: number; total_revenue: number }>;
  customerDebt: number;
  supplierDebt: number;
  cashSession: CashSession | null;
  todayProduction: number;
  todayProductionCost: number;
}

export interface JournalEntry {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  referenceType: string | null;
  referenceId: number | null;
  created_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  debit: number;
  credit: number;
  description: string | null;
  account_code?: string;
  account_name_ar?: string;
  account_name_en?: string;
}

export interface CartItem {
  productId: number;
  nameAr: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  discount: number;
  stock: number;
  unit?: string;
  size?: number | null;
  sizeUnit?: string | null;
}
