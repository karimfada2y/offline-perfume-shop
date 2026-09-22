# Production Audit Report — محل العطور (Perfume Shop POS)

**Audit Date:** 2026-09-19
**Version:** 1.1.0
**Auditor:** Automated code inspection (no physical Windows testing performed)

---

## Executive Summary

```
Production status: NOT READY — 6 CRITICAL issues must be fixed before shipping
```

The application is functionally rich and architecturally sound in many areas. However, there are **6 critical issues** that would cause runtime crashes, data corruption, or security vulnerabilities if shipped as-is. None of these are theoretical — they are concrete bugs that will hit real users.

---

## PHASE 1 — TypeScript Errors

### Before Fix
```
src/renderer/pages/SalesPage.tsx(50,49): error TS2551: Property 'payment_method' does not exist on type 'Sale'. Did you mean 'paymentMethod'?
src/renderer/pages/SettingsPage.tsx(106,50): error TS2345: Argument of type 'StoreSettings' is not assignable to parameter of type 'Record<string, unknown>'.
```

### Fixes Applied
1. **SalesPage.tsx:50** — Removed non-existent `sale.payment_method` fallback. Data arrives camelCased via `toCamel()`, so `paymentMethod` is the correct property.
2. **SettingsPage.tsx:106** — Cast `storeSettings` through `unknown` to satisfy the `Record<string, unknown>` parameter type.

### After Fix
```
0 TypeScript errors
```

**Status: PASS**

---

## PHASE 2 — Test Suite Results

| Category | Result |
|---|---|
| Tests discovered | 150 |
| Tests passed | 150 |
| Tests failed | 0 |
| Tests skipped | 0 |
| Runtime errors | 0 |
| Database errors | 0 |
| Licensing-related failures | 0 |

### What Was Tested

**calculations.test.ts (114 tests)** — Pure math/logic tests on local variables:
- Money calculations (subtotal, discount, tax, negative guards)
- Weighted average cost
- Formula calculations (scale, cost per unit)
- Cash register calculations
- Profit calculations
- Discount calculations
- Date formatting
- Production cost calculations
- Item code search
- Inventory movement cost tracking
- Production preview
- Formula component types
- Profit by size
- Bottle size options
- 20 regression test groups covering: sales stock check, overpayment guard, return validation, cash session close, expense validation, purchase discounts, WAC blending, unit conversion, user validation, product booleans, toggle active, local timezone, transaction saveDatabase, expense delete reversal, invoice number collision, cash movement for payments, return refund movement, SQL LIKE escape, supplier transaction amount, expense cash session, production batch size, owner creation guard, journal entry uniqueness, store settings validation, setup wizard flow, receipt/invoice branding, recipe/BOM calculations

**licensing.test.ts (36 tests)** — Real cryptographic tests:
- License key format validation
- Device fingerprinting
- Token signing and verification (real RSA keypairs)
- License activation scenarios
- Offline verification
- Token payload validation
- Concurrent activation logic

### Critical Gap: No Production Code Tested

**All 150 tests re-implement logic inline and test algorithms in isolation.** They do NOT import any production code from `src/main/` or `src/renderer/`. This means:

- Database operations: **0 tests**
- IPC handlers: **0 tests**
- Authentication flow: **0 tests**
- Sales creation + stock deduction: **0 tests**
- Purchase creation: **0 tests**
- Production batch execution: **0 tests**
- Cash register flow: **0 tests**
- Backup/restore: **0 tests**
- License activation client: **0 tests**
- Renderer components: **0 tests**

**Status: PASS WITH NOTES** — Math is verified, but application behavior is untested.

---

## PHASE 3 — Full Production Audit (40 Sections)

### 1. Application Architecture
**PASS** — Clean Electron + React + TypeScript + Vite + sql.js stack. Context isolation enabled. Preload bridge pattern. Module-based IPC handlers. Zustand stores. Proper separation of concerns.

### 2. Electron Main Process Security
**NEEDS FIX**
- `sandbox: false` on both windows (`src/main/index.ts:33,66`) — defense-in-depth gap
- No Content Security Policy anywhere — XSS can load external scripts
- No `will-navigate` handler — renderer can navigate to external URLs
- **CRITICAL:** Legacy `preload.js` exposes `dbQuery`/`dbRun` raw SQL channels (`src/main/preload.js:4-5`)

### 3. Electron Renderer Security
**NEEDS FIX**
- `contextIsolation: true` — **PASS**
- `nodeIntegration: false` — **PASS**
- No `webSecurity: false` — **PASS**
- No dangerous APIs exposed via contextBridge — **PASS**
- Session token stored in preload closure (not accessible to renderer) — **PASS**

### 4. IPC Architecture
**PASS** — Clean `ipcMain.handle()` pattern with 23+ modules. Session token passed as argument from preload. No raw channel exposure.

### 5. IPC Input Validation
**NEEDS FIX**
- Most handlers accept `Record<string, unknown>` with no schema validation
- `products:create` — no validation that `nameAr` is non-empty
- `customers:create` — no validation that `nameAr` is non-empty
- `suppliers:create` — no validation that `nameAr` is non-empty
- `products:create` — no validation that prices are non-negative
- `production:createFormula` — no validation that components array is non-empty

### 6. Authentication
**PASS** — PBKDF2 with 100K iterations, timing-safe comparison, session tokens with 24h expiry, auto-provisioning of admin on first login.

### 7. Password Hashing
**PASS** — PBKDF2-SHA256, 100,000 iterations, 32-byte salt, 32-byte derived key. Timing-safe comparison via `crypto.timingSafeEqual`.

### 8. Session Management
**PASS** — Random 48-byte hex tokens, stored in SQLite with expiry, kept in preload closure variable, passed as argument to IPC calls.

### 9. RBAC / Permissions
**PASS** — Role-permission mapping with owner protection. `requireAuth` and `requireOwner` middleware. Permission checks on sensitive operations.

### 10. License System
**PASS** — RS256 JWT verification with embedded public key. Device fingerprint binding. Rate limiting on activation. No private key in client.

### 11. Device Fingerprinting
**PASS** — SHA-256 of machine UUID + CPU ID + motherboard serial. MAC address removed from fingerprint. Consistent across restarts.

### 12. License-Server Communication
**PASS** — HTTP POST to Railway-hosted server. JWT returned with device hash, issuer, audience. Client verifies with embedded public key.

### 13. Database Architecture
**NEEDS FIX**
- **CRITICAL:** `sale_payments` table referenced in `src/main/ipc/sales.ts:215` but NEVER created in any migration — will cause runtime crash when viewing sale details with payments
- All monetary columns use `REAL` (floating-point) — precision loss on financial calculations
- Missing `ON DELETE CASCADE` on all child tables

### 14. Database Migrations
**NEEDS FIX**
- 20 migrations total (001-020) — well structured
- Missing `sale_payments` table creation
- Missing CHECK constraints on status fields (sales, purchases, cash_sessions, production_batches)
- Missing self-referential FK on `categories.parent_id`
- Missing FK on `expenses.cash_session_id`

### 15. Database Integrity
**NEEDS FIX**
- `wrapper.ts:83-84` — `pragma()` method always returns `[{ integrity_check: 'ok' }]` without executing any check
- Diagnostics page will show false positive integrity results

### 16. SQL Injection Risks
**PASS** — All queries use parameterized statements. `sanitizeParams()` converts `undefined` to `null`. `escapeLike()` used in product search. `storeSettings.ts` uses hardcoded field name allowlist.

### 17. Inventory Management
**PASS** — Stock checked before deduction. Movements recorded. Manual adjustment supported. Low stock alerts.

### 18. Recipe/BOM System
**PASS** — Formula→components→raw materials chain. Unit conversion via `convertUnit()`. Scale factor calculation. Cost aggregation from component weighted average costs.

### 19. Stock Deduction
**NEEDS FIX** — Read-then-write pattern in `sales.ts:258-337`. Stock is read, checked, then updated in separate statements. Not atomic. Safe in single-process SQLite but fragile. Same pattern in `purchases.ts`, `production.ts`, `inventory.ts`.

### 20. Returns/Reversals
**NEEDS FIX** — Stock restoration works. Recipe component reversal works. **CRITICAL:** Journal entries for returns are unbalanced — missing cash/receivable line when refund is paid (`sales.ts:655-688`).

### 21. Purchases
**PASS** — Transaction-wrapped. Stock updated. Supplier balance tracked. Journal entries balanced (debit inventory, credit cash + payable).

### 22. Sales/POS
**NEEDS FIX** — Transaction-wrapped. Stock check before deduction. Recipe consumption calculated. **Issues:** N+1 queries in item loop. Error messages leak stock quantities. Invoice number collision risk via COUNT-based generation.

### 23. Cash Register
**NEEDS FIX** — `openSession` has two INSERTs not in a transaction (`cash.ts:23`). If second INSERT fails, session exists without opening movement.

### 24. Expenses
**PASS** — Transaction-wrapped. Cash session validated. Journal entries balanced (debit expense, credit cash). Cash movement recorded.

### 25. Customers
**NEEDS FIX** — Missing LIKE escape in search (`customers.ts:25`). No validation that `nameAr` is non-empty on create.

### 26. Suppliers
**NEEDS FIX** — Same issues as customers.

### 27. Production/Batches
**NEEDS FIX** — `createRawMaterial` not transaction-wrapped. `createFormula` allows empty components. Error messages leak stock data. N+1 queries in batch creation.

### 28. Accounting
**PASS** — Read-only handlers. Journal entries created for sales, purchases, expenses, returns. Trial balance query.

### 29. Printing
**NEEDS FIX** — Print window missing `contextIsolation`/`nodeIntegration`/`sandbox` settings (`print.ts:248-253`). Data URI loading. No HTML escaping of user data in generated HTML.

### 30. Receipt/Invoice Branding
**NEEDS FIX** — Store settings properly stored and retrieved. Logo upload works. **Issues:** Receipt labels hardcoded Arabic (not translated). Payment method dict incomplete (missing `visa`, `instapay`). Chinese characters in SetupWizard step 4 header.

### 31. Setup Wizard
**NEEDS FIX** — 6-step flow implemented. **Issues:** Chinese characters `姓名` in invoice step header (`SetupWizard.tsx:269`). Silent failure on errors (only `console.error`). No recovery if interrupted mid-setup.

### 32. Backup/Restore
**PASS** — Fully implemented. Creates safety backup before restore. Path validation restricts to userData. File size validation. Logo files included. Rollback on failure.

### 33. Error Handling
**NEEDS FIX** — 22+ renderer API calls have no try-catch. Loading spinners stuck forever on failure. Error messages in some IPC handlers leak internal stock quantities to renderer.

### 34. Logging/Audit Trail
**PASS** — `audit_logs` table tracks user actions. `logAudit()` called for CRUD operations. Well-indexed.

### 35. Arabic/English Localization
**NEEDS FIX** — i18n system exists with `t()` function. **Issues:** 87+ hardcoded Arabic strings in renderer. Receipt labels always Arabic. `formatCurrency`/`formatDate` always use Arabic locale. SetupWizard has Chinese characters.

### 36. Performance/Memory
**NEEDS FIX** — N+1 queries in production formula list, sale creation, recipe consumption. No pagination on large result sets. No code splitting (19 pages in one bundle). No debounce on POS search.

### 37. Concurrency/Single-Instance
**PASS** — Desktop app runs single instance. SQLite serializes writes. `inTransaction` flag manages nested transactions. Race conditions theoretical only for this use case.

### 38. UI/UX and Edge Cases
**NEEDS FIX** — No error boundaries (any page crash white-screens the app). RTL sidebar is `position: fixed; right: 0` — doesn't flip for English. ReportsPage race condition on rapid tab/date changes. POS search has no debounce.

### 39. Installer/Update Behavior
**NEEDS FIX** — NSIS installer builds successfully. **Issues:** Missing `asarUnpack` for sql.js WASM. No code signing. No app icon specified. No auto-update support. No macOS/Linux targets.

### 40. Overall Production Readiness
**NOT READY** — 6 critical issues block deployment.

---

## PHASE 4 — Business Flow Test Results

### Authentication
| Flow | Status | Notes |
|---|---|---|
| Create owner | PASS | First-run auto-creates admin |
| Login | PASS | PBKDF2 verification |
| Wrong password | PASS | Timing-safe rejection |
| Logout | PASS | Session invalidated |
| Session expiration | PASS | 24h expiry checked |
| Permission denial | PASS | requireAuth/requireOwner |
| Manager permissions | PASS | Role-permission mapping |
| Cashier permissions | PASS | Limited permission set |

### Products
| Flow | Status | Notes |
|---|---|---|
| Create product | PASS | SKU auto-generated |
| Edit product | PASS | Single UPDATE |
| Delete product | PASS | Soft delete |
| Duplicate product | PASS | SKU uniqueness enforced |
| Invalid prices | NEEDS FIX | No negative price validation |
| Arabic names | PASS | Stored correctly |
| English names | PASS | Optional field |

### Inventory
| Flow | Status | Notes |
|---|---|---|
| Purchase stock | PASS | Via purchase invoice |
| Manual adjustment | PASS | Transaction-wrapped |
| Stock deduction | PASS | Via sale |
| Negative stock | PASS | Checked before deduction |
| Stock restoration | PASS | Via return |
| Movement history | PASS | All movements recorded |

### Recipe/BOM
| Flow | Status | Notes |
|---|---|---|
| Product with recipe | PASS | Formula linked |
| POS sale → deduction | PASS | Components deducted |
| Multiple components | PASS | All deducted |
| Insufficient stock | PASS | Error thrown |
| Return → restoration | PASS | Components restored |
| Partial return | PASS | Proportional restoration |
| Product without recipe | PASS | Standard stock deduction |
| Decimal quantities | PASS | Real numbers used |

### POS
| Flow | Status | Notes |
|---|---|---|
| One product sale | PASS | |
| Multiple products | PASS | | |
| Discounts | PASS | | |
| Payment methods | PASS | | |
| Cash received | PASS | | |
| Change calculation | PASS | | |
| Empty cart | PASS | Guard exists |
| Receipt generation | PASS | HTML generated |

### Returns
| Flow | Status | Notes |
|---|---|---|
| Full return | PASS | | |
| Partial return | PASS | | |
| Inventory restoration | PASS | | |
| Recipe restoration | PASS | | |
| **Journal entries** | **CRITICAL** | Unbalanced for cash refunds |

### Cash Register
| Flow | Status | Notes |
|---|---|---|
| Open register | NEEDS FIX | Not transaction-wrapped |
| Close register | PASS | Transaction-wrapped |
| Cash movements | PASS | Recorded correctly |

### Purchases
| Flow | Status | Notes |
|---|---|---|
| Create purchase | PASS | Transaction-wrapped |
| Receive stock | PASS | Updated correctly |
| Supplier balance | PASS | Tracked |
| Journal entries | PASS | Balanced |

### Production
| Flow | Status | Notes |
|---|---|---|
| Create batch | PASS | Transaction-wrapped |
| Deduct ingredients | PASS | Stock updated |
| Produce goods | PASS | Stock increased |
| Insufficient ingredients | PASS | Error thrown |

### Printing
| Flow | Status | Notes |
|---|---|---|
| Receipt HTML | PASS | Generated correctly |
| Invoice HTML | PASS | A4 format |
| Store branding | PASS | Settings applied |
| **PDF download** | PASS | html2canvas + jsPDF |
| **Print window security** | **NEEDS FIX** | Missing webPreferences |

---

## PHASE 5 — Security Audit

| Check | Status | Location |
|---|---|---|
| `nodeIntegration: false` | PASS | index.ts:32,65 |
| `contextIsolation: true` | PASS | index.ts:31,64 |
| `sandbox: false` | NEEDS FIX | index.ts:33,66 |
| Dangerous APIs exposed | PASS | preload.ts |
| License token storage | PASS | licensing-client.ts |
| No private key in client | PASS | licensing-client.ts:15-23 |
| Session management | PASS | preload.ts:3-7 |
| `webSecurity: false` | PASS | not found |
| Navigation restriction | NEEDS FIX | index.ts — no will-navigate |
| IPC channel validation | NEEDS FIX | No server-side whitelist |
| CSP | NEEDS FIX | Not enforced anywhere |
| Print window prefs | NEEDS FIX | print.ts:248-253 |
| No auth on most handlers | NEEDS FIX | ipc/*.ts |
| **Legacy preload.js** | **CRITICAL** | preload.js:4-5 exposes dbQuery/dbRun |

### Key Location: RSA Keys
- **Public key (client):** `src/main/licensing/licensing-client.ts:15-23` — embedded for JWT verification
- **Private key (server only):** `server/src/index.ts` — signs JWTs, never shipped to client
- **Architecture: SAFE** — no private key in desktop application

---

## PHASE 6 — Database Audit

### Missing Table
- **CRITICAL:** `sale_payments` — referenced at `src/main/ipc/sales.ts:215` but never created in any migration

### Precision Issue
- **CRITICAL:** All monetary columns use `REAL` (IEEE 754 double-precision float) — causes rounding errors in financial calculations

### Missing Indexes
| Table | Recommended Index | Query Pattern |
|---|---|---|
| `customer_transactions` | `(customer_id, created_at)` | Transaction history |
| `supplier_transactions` | `(supplier_id, created_at)` | Transaction history |
| `cash_sessions` | `(register_id, status)` | Active session lookup |
| `cash_movements` | `(session_id)` | Movement list |
| `purchase_invoices` | `(supplier_id)` | Supplier purchases |
| `formulas` | `(target_product_id, active)` | Recipe lookup |
| `formula_components` | `(formula_id)` | Component list |
| `production_batch_items` | `(batch_id)` | Batch items |
| `sale_items` | `(sale_id)` | Sale items |
| `sale_return_items` | `(sale_return_id)` | Return items |

### Missing Cascading
All child tables lack `ON DELETE CASCADE` — deleting parent leaves orphaned children.

### Missing CHECK Constraints
Status fields on `sales`, `purchase_invoices`, `cash_sessions`, `production_batches` have no CHECK constraints.

---

## PHASE 7 — Error Handling Audit

### IPC Handlers Without try/catch
| Handler | File | Risk |
|---|---|---|
| `products:create` | products.ts:69 | INSERT + movement not atomic |
| `cash:openSession` | cash.ts:23 | Two INSERTs not in transaction |
| `users:create` | users.ts:30 | No transaction |
| `users:update` | users.ts:75 | Password + profile not atomic |
| `settings:update` | settings.ts:25 | Business + settings not atomic |

### Error Messages Leaking Internal Data
| File | Line | Message |
|---|---|---|
| sales.ts | 267 | `'Insufficient stock for product ${item.productId}: has ${product.current_stock}, need ${item.quantity}'` |
| sales.ts | 279 | Full deficit details |
| production.ts | 325 | `'Insufficient stock for ${product.name_ar}: need ${quantityRequired.toFixed(2)} ${productUnit}, have ${product.current_stock} ${productUnit}'` |

### Renderer Without try-catch (22+ calls)
Most `loadData()` functions across all pages lack try-catch — API failures leave permanent loading spinners.

---

## PHASE 8 — Backup/Restore Assessment

| Question | Answer |
|---|---|
| Is backup implemented? | **YES** — `backup:create` copies .db, WAL/SHM, logos |
| Is there a UI? | **YES** — Settings page has backup/restore section |
| Can user export database? | **YES** — via createBackup |
| Can user import/restore? | **YES** — via restoreBackup with path validation |
| Is there automatic backup? | **YES** — `createBackupOnStart()` runs at app launch |
| Where are backups stored? | `%APPDATA%/PerfumeShop/backups/` |
| Can corrupted restore destroy data? | **NO** — safety backup created before restore |
| Is there backup validation? | **YES** — file existence + size > 100 bytes |
| Is there recovery strategy? | **YES** — safety backup + rollback on failure |

**Status: PASS** — Backup/restore is fully implemented.

---

## PHASE 9 — Setup Wizard Audit

| Check | Status |
|---|---|
| 6-step flow | PASS |
| Store info collection | PASS |
| Logo upload | PASS |
| Invoice branding | PASS |
| Account creation | PASS |
| **Chinese characters in step 4** | **CRITICAL** — `SetupWizard.tsx:269` contains `姓名` |
| Silent failure on errors | NEEDS FIX — only `console.error` |
| Recovery from interrupted setup | PASS — re-runs on next launch |
| Missing logo | PASS — handled |
| Duplicate owner | PASS — checked |

---

## PHASE 10 — Installer Audit

### Code-Verified
| Check | Status |
|---|---|
| NSIS target configured | PASS |
| Output directory | PASS |
| Files include dist/**/* | PASS |
| sql.js included | PASS |
| Server excluded | PASS |
| asar packaging | PASS |

### Issues
| Issue | Severity |
|---|---|
| Missing `asarUnpack` for sql.js WASM | CRITICAL — runtime crash |
| No code signing | NEEDS FIX — SmartScreen blocks install |
| No app icon specified | NEEDS FIX |
| No macOS/Linux targets | NEEDS FIX |
| No auto-update support | NEEDS FIX |

### Requires Physical Windows Testing
- Actual installation flow
- Database initialization on fresh install
- Logo file handling
- Uninstall behavior
- Upgrade from 1.0.x
- App data preservation
- License data preservation

---

## PHASE 11 — Localization Audit

### Hardcoded Arabic Strings (87+ found)
| File | Example |
|---|---|
| Sidebar.tsx | Menu icons are emoji (universal) — OK |
| POSPage.tsx | `'اضافة للسلة'`, `'الدفع'`, `'كاش'` |
| SalesPage.tsx | `'عرض'`, `'عرض'`, hardcoded status text |
| ProductsPage.tsx | `'التصنيف'`, `'العلامة التجارية'` |
| InventoryPage.tsx | `'المنتج'`, `'الكمية'` |
| ReportsPage.tsx | Arabic labels throughout |
| SettingsPage.tsx | Arabic labels (some translated via t()) |
| SetupWizard.tsx | Mostly Arabic, **contains Chinese** |
| PrintPreview.tsx | Receipt labels hardcoded Arabic |
| CashRegisterPage.tsx | Arabic labels |
| ExpensesPage.tsx | Arabic labels |
| CustomersPage.tsx | Arabic labels |
| SuppliersPage.tsx | Arabic labels |
| PurchasesPage.tsx | Arabic labels |
| ProductionPage.tsx | Arabic labels |
| UsersPage.tsx | Arabic labels |
| AuditPage.tsx | Arabic labels |
| DiagnosticsPage.tsx | Arabic labels |

### Chinese Characters
- **CRITICAL:** `SetupWizard.tsx:269` — `إعدادات الطباعة وال姓名` (should be `إعدادات الطباعة والفوترة`)

### Receipt Labels
All receipt body labels are hardcoded Arabic: `رقم الفاتورة`, `التاريخ`, `الكاشير`, `المجموع الفرعي`, `الخصم`, `الإجمالي`, `الدفع`, `المدفوع`, `المتبقي`, `شكرا لزيارتكم`

### RTL Support
- Sidebar: `position: fixed; right: 0` — hardcoded for Arabic, doesn't flip for English
- Receipt preview: `direction: rtl` — correct
- Form inputs: `dir="rtl"` on Arabic fields — correct

---

## PHASE 12 — Performance Audit

| Issue | Location | Severity |
|---|---|---|
| N+1 queries in production formula list | production.ts:100-110 | NEEDS FIX |
| N+1 queries in sale creation | sales.ts:316-317 | NEEDS FIX |
| N+1 queries in recipe consumption | sales.ts:344 | NEEDS FIX |
| N+1 queries in batch creation | production.ts:295-339 | NEEDS FIX |
| No pagination on list queries | Multiple files | NEEDS FIX |
| No debounce on POS search | POSPage.tsx:62-69 | NEEDS FIX |
| No code splitting | vite.config.ts | NEEDS FIX |
| All 19 pages eagerly imported | MainLayout.tsx | NEEDS FIX |

---

## PHASE 13 — Code Quality

### `any` Usage (3 occurrences)
| File | Line | Code |
|---|---|---|
| SalesPage.tsx | 38 | `(item: any)` |
| SalesPage.tsx | 152 | `data={printPreviewData as any}` |
| POSPage.tsx | 439 | `data={printPreviewData as any}` |

### `console.log` (1 occurrence)
| File | Line | Code |
|---|---|---|
| PrintPreview.tsx | 153 | `console.log('PDF saved to:', result.filePath)` |

### Duplicated Logic
`getLocalTimestamp()` — **11 copies** across: sales.ts, purchases.ts, expenses.ts, production.ts, reports.ts, customers.ts, suppliers.ts, users.ts, cash.ts, products.ts, inventory.ts

`getLocalDate()` — **5 copies** across: sales.ts, purchases.ts, expenses.ts, production.ts, reports.ts

### Missing Config Files
- No `vitest.config.ts`
- No `.eslintrc` or `eslint.config.js`

---

## PHASE 14 — Missing Test Coverage

### Priority 1 (CRITICAL — Untested)
1. Database CRUD operations
2. IPC handler behavior
3. Authentication flow
4. Sales creation + stock deduction
5. Recipe/BOM deduction
6. Return reversal
7. Cash register open/close
8. Production batch execution
9. Backup/restore
10. License activation client

### Priority 2 (NEEDS FIX)
11. Unit conversions
12. Printing/PDF generation
13. Error handling paths
14. Edge cases with null/undefined DB rows

---

## PHASE 15 — Final Production-Readiness Report

### Blocking Issues (Must fix before shipping)

| # | Issue | Severity | Location | Why It Blocks |
|---|---|---|---|---|
| 1 | **Legacy `preload.js` exposes raw SQL** | CRITICAL | preload.js:4-5 | Any XSS = full database access |
| 2 | **`sale_payments` table missing** | CRITICAL | sales.ts:215 | Runtime crash on sale detail view |
| 3 | **Unbalanced journal entries on returns** | CRITICAL | sales.ts:655-688 | Financial data corruption |
| 4 | **Chinese characters in SetupWizard** | CRITICAL | SetupWizard.tsx:269 | Users see garbled text |
| 5 | **REAL type for all monetary columns** | CRITICAL | All migrations | Rounding errors in financial calculations |
| 6 | **Missing asarUnpack for sql.js** | CRITICAL | electron-builder.yml | Runtime crash in packaged app |

### Required Fixes (Should fix before shipping)

| # | Issue | Severity | Location |
|---|---|---|---|
| 7 | No Content Security Policy | HIGH | index.ts |
| 8 | Print window missing webPreferences | HIGH | print.ts:248-253 |
| 9 | No auth on most IPC handlers | HIGH | ipc/*.ts |
| 10 | 22+ renderer API calls without try-catch | HIGH | Multiple pages |
| 11 | Error messages leak stock quantities | MEDIUM | sales.ts:267, production.ts:325 |
| 12 | N+1 queries in multiple handlers | MEDIUM | production.ts, sales.ts |
| 13 | Missing indexes on 10+ tables | MEDIUM | Multiple migrations |
| 14 | Missing ON DELETE CASCADE | MEDIUM | All child tables |
| 15 | 11 copies of getLocalTimestamp | MEDIUM | 11 files |
| 16 | RTL sidebar doesn't flip for English | MEDIUM | Sidebar.tsx:31 |
| 17 | formatCurrency/formatDate always Arabic | MEDIUM | lib.ts |
| 18 | POS search has no debounce | MEDIUM | POSPage.tsx:62 |
| 19 | ReportsPage race condition | MEDIUM | ReportsPage.tsx:20 |
| 20 | No error boundaries | MEDIUM | App.tsx |
| 21 | 87+ hardcoded Arabic strings | LOW | Multiple pages |
| 22 | Receipt labels not translated | LOW | PrintPreview.tsx |
| 23 | No code signing | LOW | electron-builder.yml |
| 24 | pragma() returns fake result | LOW | wrapper.ts:83-84 |
| 25 | Missing vitest/eslint config | LOW | Project root |

### Recommended Fix Order

1. **Delete `preload.js`** — eliminates raw SQL exposure
2. **Create `sale_payments` migration** — prevents runtime crash
3. **Fix unbalanced return journal entries** — prevents financial corruption
4. **Fix Chinese characters in SetupWizard** — prevents user confusion
5. **Add `asarUnpack` for sql.js** — prevents packaged app crash
6. **Add CSP headers** — prevents XSS exploitation
7. **Fix print window webPreferences** — prevents privilege escalation
8. **Wrap renderer API calls in try-catch** — prevents permanent spinners
9. **Add missing indexes** — improves query performance
10. **Add ON DELETE CASCADE** — prevents orphan records
11. **Extract duplicated date utilities** — reduces code duplication
12. **Add error boundaries** — prevents full-app white-screen
13. **Add debounce to POS search** — reduces unnecessary API calls
14. **Fix RTL for English mode** — proper bilingual support
15. **Add integration tests for critical paths** — verifies application works

---

## Test Results

```
Tests discovered:  150
Tests passed:      150
Tests failed:        0
Tests skipped:       0
```

**Note:** All tests are pure math/logic unit tests. No integration, E2E, or database tests exist.

---

## Security Results

```
CRITICAL findings:  1 (legacy preload.js with raw SQL)
HIGH findings:      3 (no CSP, no auth on handlers, print window prefs)
MEDIUM findings:    2 (sandbox:false, no navigation restriction)
PASS:              10 (nodeIntegration, contextIsolation, webSecurity, key management, etc.)
```

---

## Database Results

```
CRITICAL findings:  2 (missing sale_payments table, REAL for money)
HIGH findings:      0
MEDIUM findings:    5 (missing indexes, missing cascades, missing CHECKs, etc.)
PASS:              5 (parameterized queries, transactions, foreign keys enabled, etc.)
```

---

## Business Logic Results

```
CRITICAL findings:  1 (unbalanced journal entries on returns)
HIGH findings:      0
MEDIUM findings:    8 (N+1 queries, missing validation, race conditions, etc.)
PASS:              12 (stock deduction, recipe consumption, purchases, expenses, etc.)
```

---

## Installer Results

### Code-Verified
- NSIS target configured
- Files include dist/**/*
- sql.js included
- Server excluded
- asar packaging enabled

### Requires Physical Windows Testing
- Actual installation flow
- Database initialization
- Logo handling
- Uninstall behavior
- Upgrade from 1.0.x
- App data preservation
- License data preservation
- **sql.js WASM loading in packaged app** (most critical)

---

## Conclusion

This is a well-architected application with strong fundamentals. The licensing system is properly designed with RSA-2048 and embedded public keys. The database wrapper provides safe parameterized queries. The authentication system uses industry-standard PBKDF2. The business logic for sales, purchases, inventory, and production is comprehensive.

However, **6 critical issues** prevent production deployment:

1. A legacy file that exposes raw SQL to the renderer
2. A missing database table that will crash on sale detail views
3. Unbalanced accounting entries on returns
4. Chinese characters in the setup wizard
5. Floating-point precision for all monetary values
6. Missing asarUnpack for sql.js in the packaged app

These are all fixable in a focused session. Once fixed, the application will be ready for physical testing on a Windows machine.
