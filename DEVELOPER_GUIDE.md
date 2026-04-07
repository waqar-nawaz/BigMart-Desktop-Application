# BigMart POS — Complete Developer Guide

> Electron 28 · Angular 17 · SQLite3 (better-sqlite3) · TypeScript

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Full Folder Structure](#2-full-folder-structure)
3. [Architecture Deep Dive](#3-architecture-deep-dive)
4. [Setup & Running](#4-setup--running)
5. [How Each Layer Works](#5-how-each-layer-works)
6. [HOW TO: Add a New Feature (Step-by-Step)](#6-how-to-add-a-new-feature)
7. [HOW TO: Modify Existing Features](#7-how-to-modify-existing-features)
8. [HOW TO: Add a New Database Table](#8-how-to-add-a-new-database-table)
9. [HOW TO: Add a New Screen in Angular](#9-how-to-add-a-new-screen-in-angular)
10. [HOW TO: Add a New IPC Channel (API Endpoint)](#10-how-to-add-a-new-ipc-channel)
11. [Debugging Guide](#11-debugging-guide)
12. [Building for Production](#12-building-for-production)
13. [Deployment & Distribution](#13-deployment--distribution)
14. [Common Errors & Fixes](#14-common-errors--fixes)
15. [Code Conventions](#15-code-conventions)

---

## 1. PROJECT OVERVIEW

BigMart POS is a **desktop application** that runs entirely offline. It uses:

| Layer  | Technology                    | Purpose                                |
| ------ | ----------------------------- | -------------------------------------- |
| UI     | Angular 17 + Angular Material | All screens, forms, dashboards         |
| Shell  | Electron 28                   | Desktop window, menu, native OS APIs   |
| DB     | SQLite3 (better-sqlite3)      | Local database, zero server needed     |
| Bridge | Electron contextBridge / IPC  | Secure Angular ↔ Node.js communication |

**Data Flow:**

```
User clicks button in Angular
    ↓
Angular Component calls a Service method
    ↓
Service calls ElectronService.someMethod()
    ↓
ElectronService calls window.electronAPI.someMethod()  (via preload.js)
    ↓
IPC message sent to Electron main process
    ↓
IPC Registry routes to Controller
    ↓
Controller calls Service
    ↓
Service calls Model
    ↓
Model runs SQLite3 query
    ↓
Result bubbles back up the same chain
    ↓
Angular component receives the data and renders it
```

---

## 2. FULL FOLDER STRUCTURE

```
bigmart-pos-full/
│
├── package.json                    ← Root (Electron deps, build scripts)
├── README.md
│
├── electron/                       ══ ELECTRON (Node.js Backend) ══
│   ├── main.js                     ← Entry point (bootstraps everything)
│   ├── assets/
│   │   ├── icon.ico                ← Windows app icon
│   │   ├── icon.icns               ← macOS app icon
│   │   └── icon.png                ← Linux app icon
│   └── src/
│       ├── config/
│       │   └── window.config.js    ← BrowserWindow settings
│       │
│       ├── database/
│       │   ├── database.js         ← SQLite3 connection + schema creation
│       │   └── seed.js             ← Default data (users, categories, products)
│       │
│       ├── models/                 ← Data Access Layer (SQLite queries)
│       │   ├── base.model.js       ← Base CRUD class (extend this)
│       │   ├── product.model.js    ← Products queries
│       │   └── models.js           ← User, Customer, Sale, Purchase, Supplier models
│       │
│       ├── services/               ← Business Logic Layer
│       │   ├── auth.service.js     ← Login, PIN auth, user CRUD
│       │   ├── product.service.js  ← Product CRUD, image handling, bulk import
│       │   └── services.js         ← Sale, Inventory, Setting, Report services
│       │
│       ├── controllers/
│       │   └── controllers.js      ← ALL controllers (Auth, Product, Sale, etc.)
│       │                             Thin layer: receive IPC args → call service → return
│       │
│       ├── ipc/
│       │   └── ipc.registry.js     ← Registers ALL ipcMain.handle() calls
│       │
│       ├── preload/
│       │   └── preload.js          ← Secure bridge: exposes window.electronAPI
│       │
│       ├── middleware/             ← (reserved for validation, rate limiting)
│       └── utils/
│           ├── logger.js           ← Console logger with levels & colours
│           └── scheduler.js        ← Background jobs (low-stock, auto-backup)
│
└── angular-app/                    ══ ANGULAR (UI Frontend) ══
    ├── package.json                ← Angular dependencies
    ├── angular.json                ← Angular CLI config (build, serve)
    ├── tsconfig.json               ← TypeScript config
    └── src/
        ├── index.html              ← App shell HTML
        ├── main.ts                 ← Angular bootstrap
        ├── styles.scss             ← Global CSS (dark theme design system)
        └── app/
            ├── app.component.ts    ← Root component (<router-outlet>)
            ├── app.module.ts       ← Root NgModule (all declarations)
            ├── app-routing.module.ts ← All routes
            │
            ├── core/               ── CORE (Singleton Services & Types) ──
            │   ├── models/
            │   │   └── index.ts    ← ALL TypeScript interfaces (Product, Sale, etc.)
            │   ├── services/
            │   │   ├── electron.service.ts  ← IPC bridge (calls window.electronAPI)
            │   │   ├── auth.service.ts      ← Auth state (currentUser, activeShift)
            │   │   └── settings.service.ts  ← App settings + NotificationService
            │   └── guards/
            │       └── auth.guard.ts        ← AuthGuard + RoleGuard
            │
            ├── shared/             ── SHARED (Reusable Components) ──
            │   ├── components/
            │   │   ├── main-layout/     ← Sidebar + router outlet wrapper
            │   │   ├── confirm-dialog/  ← Reusable confirm dialog
            │   │   ├── stat-card/       ← KPI card component
            │   │   ├── page-header/     ← Page title component
            │   │   └── data-table/      ← Generic table wrapper
            │   ├── directives/
            │   ├── pipes/
            │   │   └── currency.pipe.ts ← Currency formatting pipe
            │   └── utils/
            │
            └── modules/            ── FEATURE MODULES ──
                ├── auth/
                │   ├── components/
                │   │   └── login.component.ts/html/scss
                │   ├── services/        ← (uses core/AuthService)
                │   └── models/
                │
                ├── dashboard/
                │   ├── components/
                │   │   └── dashboard.component.ts/html/scss
                │   ├── services/
                │   └── models/
                │
                ├── pos/
                │   ├── components/
                │   │   ├── pos.component.ts/html/scss         ← Main POS screen
                │   │   ├── cart-item.component.ts             ← Cart row
                │   │   ├── payment-dialog.component.ts/html   ← Checkout dialog
                │   │   ├── receipt-dialog.component.ts/html   ← Receipt/PDF
                │   │   ├── customer-select-dialog.component.ts
                │   │   └── discount-dialog.component.ts
                │   ├── services/
                │   │   └── cart.service.ts   ← Cart state management
                │   └── models/
                │
                ├── inventory/
                │   ├── components/
                │   │   ├── inventory.component.ts/html      ← Product list
                │   │   ├── product-form-dialog.component.ts ← Add/Edit product
                │   │   ├── stock-adjustment-dialog.component.ts
                │   │   ├── category-manager.component.ts
                │   │   └── low-stock.component.ts
                │   ├── services/
                │   │   └── inventory.service.ts
                │   └── models/
                │
                ├── sales/
                │   ├── components/
                │   │   ├── sales.component.ts/html
                │   │   └── sale-detail-dialog.component.ts
                │   ├── services/
                │   │   └── sale.service.ts
                │   └── models/
                │
                ├── purchases/
                │   ├── components/
                │   │   ├── purchases.component.ts/html
                │   │   ├── purchase-form.component.ts/html
                │   │   └── purchase-detail.component.ts/html
                │   ├── services/
                │   └── models/
                │
                ├── customers/
                │   ├── components/
                │   │   ├── customers.component.ts/html
                │   │   ├── customer-form-dialog.component.ts
                │   │   └── customer-detail.component.ts
                │   ├── services/
                │   │   └── customer.service.ts
                │   └── models/
                │
                ├── suppliers/
                │   ├── components/
                │   │   ├── suppliers.component.ts/html
                │   │   └── supplier-form-dialog.component.ts/html
                │   ├── services/
                │   └── models/
                │
                ├── employees/
                │   ├── components/
                │   │   ├── employees.component.ts/html
                │   │   └── employee-form-dialog.component.ts
                │   ├── services/
                │   └── models/
                │
                ├── reports/
                │   ├── components/
                │   │   └── reports.component.ts/html
                │   ├── services/
                │   └── models/
                │
                ├── settings/
                │   ├── components/
                │   │   └── settings.component.ts/html
                │   ├── services/
                │   └── models/
                │
                ├── expenses/
                │   ├── components/
                │   │   └── expenses.component.ts/html
                │   └── services/
                │
                └── shifts/
                    ├── components/
                    │   ├── shifts.component.ts/html
                    │   └── shift-dialog.component.ts
                    └── services/
```

---

## 3. ARCHITECTURE DEEP DIVE

### The 5-Layer Stack

```
┌─────────────────────────────────────────────────────┐
│  LAYER 5: Angular Components (UI)                   │
│  What:  HTML templates, user interaction            │
│  Where: angular-app/src/app/modules/*/components/   │
│  Rule:  Components should NOT talk to Electron      │
│         They call Angular Services only             │
└─────────────────────────────────────────────────────┘
         ↕  calls methods on
┌─────────────────────────────────────────────────────┐
│  LAYER 4: Angular Services (Feature-level)          │
│  What:  Business logic in the frontend              │
│  Where: angular-app/src/app/modules/*/services/     │
│  Rule:  Feature services call ElectronService only  │
└─────────────────────────────────────────────────────┘
         ↕  calls via
┌─────────────────────────────────────────────────────┐
│  LAYER 3: ElectronService + contextBridge           │
│  What:  The secure IPC bridge                       │
│  Where: core/services/electron.service.ts           │
│         electron/src/preload/preload.js             │
│  Rule:  ONE typed method per IPC channel            │
└─────────────────────────────────────────────────────┘
         ↕  ipcRenderer.invoke ↔ ipcMain.handle
┌─────────────────────────────────────────────────────┐
│  LAYER 2: Controllers (Electron main process)       │
│  What:  Thin IPC handlers, call services            │
│  Where: electron/src/controllers/controllers.js     │
│         electron/src/ipc/ipc.registry.js            │
│  Rule:  Controllers validate args & call service    │
└─────────────────────────────────────────────────────┘
         ↕  calls
┌─────────────────────────────────────────────────────┐
│  LAYER 1: Services + Models (Node.js)               │
│  What:  Business logic + SQLite3 queries            │
│  Where: electron/src/services/ + models/            │
│  Rule:  Models only do DB queries                   │
│         Services contain business rules             │
└─────────────────────────────────────────────────────┘
         ↕  SQL
┌─────────────────────────────────────────────────────┐
│  LAYER 0: SQLite3 Database (bigmart.db)             │
│  Where: %APPDATA%/bigmart-pos/bigmart.db            │
└─────────────────────────────────────────────────────┘
```

---

## 4. SETUP & RUNNING

### Prerequisites

| Tool        | Version | Install                 |
| ----------- | ------- | ----------------------- |
| Node.js     | 18+     | https://nodejs.org      |
| npm         | 9+      | comes with Node         |
| Angular CLI | 17+     | `npm i -g @angular/cli` |

### First-Time Setup

**Manual setup (Linux, macOS, Windows):**

```bash
# 1. Install Electron dependencies
npm install

# 2. Install Angular dependencies
cd angular-app && npm install && cd ..
```

### Running the Application

**Development mode with Electron (recommended):**

```bash
npm run dev
```

This runs Angular dev server on port 4200, then launches Electron window pointed at it.
Any change to Angular files triggers instant hot-reload WITHOUT restarting Electron.
DevTools opens on the right side for debugging.

**Run only Angular in browser (no Electron):**

```bash
npm run browser
```

This opens http://localhost:4200 in your default browser.
**Note:** Electron features (SQLite, file dialogs, etc.) won't work in browser mode. Use this for:

- Testing UI in a real browser environment
- Debugging CSS/responsive design issues

**Run only Angular dev server (manual browser access):**

```bash
cd angular-app && ng serve
# Then open http://localhost:4200 in browser
```

**Run only Electron (after building Angular):**

```bash
npm run ng:build    # Build Angular first
npm start           # Launch Electron
```

### Common Development Workflow

```bash
# Terminal 1: Start Angular dev server
cd angular-app && ng serve

# Terminal 2: Start Electron (pointed at Angular dev server)
NODE_ENV=development electron . --dev
```

### Default Users & Login Credentials

When the database initializes for the first time, **5 default employees** are automatically seeded:

| Username   | Password   | Role       | PIN  | First Name       | Purpose                      |
| ---------- | ---------- | ---------- | ---- | ---------------- | ---------------------------- |
| admin      | admin123   | Admin      | 1234 | System Admin     | Full system access           |
| manager    | manager123 | Manager    | 2345 | Store Manager    | Management features          |
| cashier    | cashier123 | Cashier    | 5678 | John Cashier     | POS & sales operations       |
| supervisor | super123   | Supervisor | 3456 | Sarah Supervisor | Supervision & oversight      |
| accountant | account123 | Accountant | 4567 | Mike Accountant  | Financial reporting & audits |

**How to use:**

1. Open the application
2. Login with any username/password combo from above (e.g., `admin` / `admin123`)
3. Or use PIN login with the PIN field
4. Once logged in, go to **Employees** tab to view, edit, or create new users

**Note:** These default credentials are seeded only once. If the database already has users, new seed data is not added.

---

## 5. HOW EACH LAYER WORKS

### 5.1 Database (electron/src/database/)

**database.js** — Creates the SQLite connection, runs schema, calls seeder.
**seed.js** — Inserts default data (users, categories, products, settings).

The database file lives at:

- Windows: `C:\Users\<YOU>\AppData\Roaming\bigmart-pos\bigmart.db`
- macOS: `~/Library/Application Support/bigmart-pos/bigmart.db`
- Linux: `~/.config/bigmart-pos/bigmart.db`

To inspect the database manually:

```bash
# Install SQLite browser: https://sqlitebrowser.org
# Or use CLI:
sqlite3 bigmart.db
sqlite3 bigmart.db ".tables"
sqlite3 bigmart.db "SELECT * FROM products LIMIT 5;"
```

### 5.2 Models (electron/src/models/)

Models are simple wrappers around better-sqlite3 prepared statements.
`BaseModel` provides generic CRUD. Extend it for each table:

```javascript
// Example: electron/src/models/product.model.js
const BaseModel = require("./base.model");

class ProductModel extends BaseModel {
  constructor() {
    super("products");
  }

  // Custom query not in BaseModel
  findByBarcode(barcode) {
    return this.queryOne("SELECT * FROM products WHERE barcode = ?", [barcode]);
  }
}

module.exports = new ProductModel(); // Export singleton
```

**Available BaseModel methods:**

- `findById(id)` — SELECT by primary key
- `findAll(conditions, params)` — SELECT with WHERE clause
- `findOne(conditions, params)` — SELECT LIMIT 1
- `count(conditions, params)` — COUNT(\*)
- `insert(data)` — INSERT (keys = column names)
- `updateById(id, data)` — UPDATE by id
- `softDelete(id)` — Sets is_active = 0
- `hardDelete(id)` — Physical DELETE
- `query(sql, params)` — Raw SELECT (returns array)
- `queryOne(sql, params)` — Raw SELECT (returns object)
- `run(sql, params)` — Raw UPDATE/INSERT/DELETE
- `transaction(fn)` — Wrap in SQLite transaction

### 5.3 Services (electron/src/services/)

Services contain business logic. They import and call models. Multiple models can be orchestrated in one service.

```javascript
// Pattern:
const ProductService = {
  create(data) {
    // Validate
    if (!data.name) throw new Error("Name required");
    // Transform
    if (!data.barcode) data.barcode = `BM${Date.now()}`;
    // Call model
    return productModel.insert({ id: uuidv4(), ...data });
  },
};
```

### 5.4 Controllers (electron/src/controllers/)

Controllers are the thinnest layer. They:

1. Receive raw IPC arguments
2. Optionally validate/parse them
3. Call the service method
4. Return the result

```javascript
const SaleController = {
  create: (data) => SaleService.create(data),
  getById: (id) => SaleService.getById(id),
};
```

### 5.5 IPC Registry (electron/src/ipc/ipc.registry.js)

Registers every channel:

```javascript
ipcMain.handle("sales:create", (event, data) => SaleController.create(data));
ipcMain.handle("sales:getById", (event, id) => SaleController.getById(id));
```

### 5.6 Preload (electron/src/preload/preload.js)

Exposes a typed API to the Angular renderer:

```javascript
contextBridge.exposeInMainWorld("electronAPI", {
  sales: {
    create: (d) => ipcRenderer.invoke("sales:create", d),
    getById: (id) => ipcRenderer.invoke("sales:getById", id),
  },
});
```

### 5.7 ElectronService (Angular)

The Angular bridge to Electron:

```typescript
@Injectable({ providedIn: "root" })
export class ElectronService {
  createSale(data: any) {
    return this.api.sales.create(data);
  }
  getSaleById(id: string) {
    return this.api.sales.getById(id);
  }
}
```

### 5.8 Feature Service (Angular)

Business logic in Angular:

```typescript
@Injectable({ providedIn: "root" })
export class SaleService {
  async create(cartData: any) {
    const result = await this.electronService.createSale(cartData);
    if (result.success) this.notifications.success("Sale completed!");
    return result;
  }
}
```

### 5.9 Component (Angular)

UI layer — calls feature service:

```typescript
@Component({ ... })
export class PosComponent {
  async checkout() {
    const result = await this.saleService.create(this.cartService.buildSalePayload());
    // Update UI
  }
}
```

---

## 6. HOW TO: Add a New Feature

### Example: Add a "Gift Cards" module

#### Step 1: Database — Add the table

Open `electron/src/database/database.js`, add inside `createSchema()`:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS gift_cards (
    id          TEXT PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    balance     REAL NOT NULL DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);
```

#### Step 2: Model — Add queries

Create `electron/src/models/gift-card.model.js`:

```javascript
const BaseModel = require("./base.model");

class GiftCardModel extends BaseModel {
  constructor() {
    super("gift_cards");
  }

  findByCode(code) {
    return this.queryOne(
      "SELECT * FROM gift_cards WHERE code = ? AND is_active = 1",
      [code],
    );
  }

  deductBalance(id, amount) {
    return this.run(
      "UPDATE gift_cards SET balance = balance - ? WHERE id = ?",
      [amount, id],
    );
  }
}

module.exports = new GiftCardModel();
```

#### Step 3: Service — Add business logic

Create `electron/src/services/gift-card.service.js`:

```javascript
const { v4: uuidv4 } = require("uuid");
const giftCardModel = require("../models/gift-card.model");

const GiftCardService = {
  create(code, balance, createdBy) {
    const id = uuidv4();
    giftCardModel.insert({ id, code, balance, created_by: createdBy });
    return { success: true, id };
  },
  redeem(code, amount) {
    const card = giftCardModel.findByCode(code);
    if (!card) return { success: false, message: "Card not found" };
    if (card.balance < amount)
      return { success: false, message: "Insufficient balance" };
    giftCardModel.deductBalance(card.id, amount);
    return { success: true, newBalance: card.balance - amount };
  },
};

module.exports = GiftCardService;
```

#### Step 4: Controller — Wire service

Add to `electron/src/controllers/controllers.js`:

```javascript
const GiftCardService = require('../services/gift-card.service');

const GiftCardController = {
  create: (code, balance, userId) => GiftCardService.create(code, balance, userId),
  redeem: (code, amount)          => GiftCardService.redeem(code, amount),
};

// Add to module.exports at the bottom:
module.exports = { ..., GiftCardController };
```

#### Step 5: IPC — Register channels

Add to `electron/src/ipc/ipc.registry.js` inside `registerAllIPC()`:

```javascript
ipcMain.handle("giftCards:create", (e, { code, balance, userId }) =>
  GiftCardController.create(code, balance, userId),
);
ipcMain.handle("giftCards:redeem", (e, { code, amount }) =>
  GiftCardController.redeem(code, amount),
);
```

#### Step 6: Preload — Expose to Angular

Add to `electron/src/preload/preload.js`:

```javascript
giftCards: {
  create: (d) => ipcRenderer.invoke('giftCards:create', d),
  redeem: (d) => ipcRenderer.invoke('giftCards:redeem', d),
},
```

#### Step 7: ElectronService — Add typed methods

Add to `angular-app/src/app/core/services/electron.service.ts`:

```typescript
createGiftCard(d: { code: string; balance: number; userId: string }) {
  return this.api.giftCards.create(d) as Promise<ApiResponse>;
}
redeemGiftCard(d: { code: string; amount: number }) {
  return this.api.giftCards.redeem(d) as Promise<{ success: boolean; newBalance?: number; message?: string }>;
}
```

#### Step 8: TypeScript Interface — Add model

Add to `angular-app/src/app/core/models/index.ts`:

```typescript
export interface GiftCard {
  id: string;
  code: string;
  balance: number;
  is_active: number;
  created_by: string | null;
  created_at: string;
}
```

#### Step 9: Angular Feature Service

Create `angular-app/src/app/modules/gift-cards/services/gift-card.service.ts`:

```typescript
@Injectable({ providedIn: "root" })
export class GiftCardService {
  constructor(private electronService: ElectronService) {}
  create(data: any) {
    return this.electronService.createGiftCard(data);
  }
  redeem(code: string, amount: number) {
    return this.electronService.redeemGiftCard({ code, amount });
  }
}
```

#### Step 10: Angular Component + Route

Create `angular-app/src/app/modules/gift-cards/components/gift-cards.component.ts`
Declare in `app.module.ts`
Add route in `app-routing.module.ts`
Add nav item in `main-layout.component.ts`

---

## 7. HOW TO: Modify Existing Features

### Change the receipt format

File: `angular-app/src/app/modules/pos/receipt-dialog/receipt-dialog.component.html`

- Modify the HTML template for visual changes
- To change PDF layout: modify `exportPDF()` in the `.ts` file (uses jsPDF)

### Add a new product field (e.g., "SKU")

1. **Database**: Add column to schema in `database.js`:
   ```sql
   sku TEXT,
   ```
2. **Seed**: If you want default SKUs, add to `seed.js`
3. **Product Service**: Add `sku` to the `insert()` and `update()` calls in `product.service.js`
4. **Product Model**: Add to `findWithRelations()` SELECT if needed
5. **TypeScript**: Add `sku?: string` to `Product` interface in `core/models/index.ts`
6. **Form**: Add `sku: ['']` to FormGroup in `product-form-dialog.component.ts`
7. **Template**: Add `<mat-form-field>` for SKU in `product-form-dialog.component.html`
8. **Table**: Add column to `inventory.component.html` table

### Change payment method options

File: `angular-app/src/app/modules/pos/payment-dialog/payment-dialog.component.html`
Add a new `.method-btn` button. Update `PaymentMethod` type in `core/models/index.ts`.

### Change the POS keyboard shortcuts

File: `angular-app/src/app/modules/pos/pos.component.ts`
Modify the `@HostListener('document:keydown', ['$event'])` handler.

### Change the low-stock threshold globally

File: `electron/src/database/seed.js`
Change `low_stock_threshold` in `defaultSettings`.
Or via the app: Settings → POS & Sales → Low Stock Threshold.

---

## 8. HOW TO: Add a New Database Table

1. Open `electron/src/database/database.js`
2. Find `createSchema()` function
3. Add your `CREATE TABLE IF NOT EXISTS` block:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS my_new_table (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    value      REAL DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  -- Add index if you'll filter by this column frequently:
  CREATE INDEX IF NOT EXISTS idx_my_new_table_name ON my_new_table(name);
`);
```

4. If you need default data, add it to `seed.js`

**Column type reference:**
| SQLite Type | Use For |
|------------|---------|
| TEXT | Strings, dates (ISO format), UUIDs |
| REAL | Decimals, prices, quantities |
| INTEGER | Counts, booleans (0/1), sequences |
| BLOB | Binary data (rarely needed) |

---

## 9. HOW TO: Add a New Screen in Angular

### Step 1: Create the files

```bash
# Create directory structure
mkdir -p angular-app/src/app/modules/my-feature/components
mkdir -p angular-app/src/app/modules/my-feature/services
mkdir -p angular-app/src/app/modules/my-feature/models

# Create component files
touch angular-app/src/app/modules/my-feature/components/my-feature.component.ts
touch angular-app/src/app/modules/my-feature/components/my-feature.component.html
touch angular-app/src/app/modules/my-feature/components/my-feature.component.scss
```

### Step 2: Write the component

```typescript
// my-feature.component.ts
import { Component, OnInit } from "@angular/core";

@Component({
  selector: "app-my-feature",
  templateUrl: "./my-feature.component.html",
  styleUrls: ["./my-feature.component.scss"],
})
export class MyFeatureComponent implements OnInit {
  data: any[] = [];

  constructor(private electronService: ElectronService) {}

  async ngOnInit() {
    this.data = await this.electronService.someMethod();
  }
}
```

### Step 3: Declare in app.module.ts

```typescript
// In the @NgModule declarations array:
declarations: [
  // ... existing components ...
  MyFeatureComponent,
];
```

### Step 4: Add the route in app-routing.module.ts

```typescript
import { MyFeatureComponent } from './modules/my-feature/components/my-feature.component';

// In the children array:
{ path: 'my-feature', component: MyFeatureComponent }
```

### Step 5: Add nav item in main-layout.component.ts

```typescript
navItems: NavItem[] = [
  // ... existing items ...
  { label: 'My Feature', icon: 'star', route: '/my-feature' },
];
```

---

## 10. HOW TO: Add a New IPC Channel

Every communication between Angular and Node.js goes through IPC.

### The 4 files you always edit:

**File 1 — IPC Registry** (`electron/src/ipc/ipc.registry.js`):

```javascript
ipcMain.handle("myFeature:doSomething", (event, param1, param2) =>
  MyController.doSomething(param1, param2),
);
```

**File 2 — Controller** (`electron/src/controllers/controllers.js`):

```javascript
const MyController = {
  doSomething: (param1, param2) => MyService.doSomething(param1, param2),
};
module.exports = { ...existingExports, MyController };
```

**File 3 — Preload** (`electron/src/preload/preload.js`):

```javascript
myFeature: {
  doSomething: (p1, p2) => ipcRenderer.invoke('myFeature:doSomething', p1, p2),
},
```

**File 4 — ElectronService** (`angular-app/src/app/core/services/electron.service.ts`):

```typescript
doSomething(p1: string, p2: number): Promise<any> {
  return this.api.myFeature.doSomething(p1, p2);
}
```

---

## 11. DEBUGGING GUIDE

### Opening DevTools

- Press `Ctrl+Shift+I` (when in dev mode)
- Or set `openDevTools: true` in `window.config.js`

### Debugging the Angular (Renderer) side

1. Open DevTools in the Electron window
2. Use the Console tab for logs
3. Use the Network tab to see IPC (not real HTTP, but Angular logs show)
4. Use Angular DevTools extension (Chrome)

### Debugging the Node.js (Main Process) side

```bash
# Start with inspector
electron . --inspect=5858 --dev

# Then open chrome://inspect in Chrome → Remote Target → inspect
```

Or add `console.log` statements in any `.js` file in `electron/src/` — they print to the terminal.

### Check the database directly

```bash
# Find your database
# Windows: %APPDATA%\bigmart-pos\bigmart.db
# Mac: ~/Library/Application Support/bigmart-pos/bigmart.db

sqlite3 ~/Library/Application\ Support/bigmart-pos/bigmart.db

# Useful commands:
.tables                   -- list all tables
.schema products          -- show table structure
SELECT * FROM products;   -- view data
SELECT * FROM settings;   -- check settings
```

### Common log messages

| Log                         | Cause                                               |
| --------------------------- | --------------------------------------------------- |
| `Database path: ...`        | DB initialized OK                                   |
| `[LowStock] ...`            | Low stock notification sent                         |
| `[AutoBackup] Created: ...` | Daily backup succeeded                              |
| `Error: SQLITE_CONSTRAINT`  | Unique constraint violated (duplicate barcode etc.) |
| `electronAPI not available` | Running in browser, not Electron                    |

---

## 12. BUILDING FOR PRODUCTION

### Build Angular only (test production build)

```bash
cd angular-app && ng build --configuration production
```

Output goes to `angular-app/dist/bigmart/`

### Build Electron installer

**Windows (.exe installer):**

```bash
npm run dist:win
```

Output: `release/BigMart POS Setup 1.0.0.exe`

**macOS (.dmg):**

```bash
npm run dist:mac
```

Output: `release/BigMart POS-1.0.0.dmg`

**Linux (.AppImage):**

```bash
npm run dist:linux
```

Output: `release/BigMart POS-1.0.0.AppImage`

---

## 13. DEPLOYMENT & DISTRIBUTION

### Windows

1. Run `npm run dist:win`
2. Share the `.exe` file from `release/` folder
3. Users double-click to install
4. App installs to `C:\Program Files\BigMart POS\`
5. Database creates automatically in `%APPDATA%\bigmart-pos\`

### Updating the app

1. Bump version in root `package.json`
2. Build the new installer
3. Replace the old one

### Backup strategy for users

- Automated backup: Settings → Backup → Enable Auto-backup
- Manual backup: Settings → Backup → Create Backup Now
- Backup folder: `%APPDATA%\bigmart-pos\backups\` (Windows)

---

## 14. COMMON ERRORS & FIXES

### "better-sqlite3 is not a valid module"

**Cause**: Native module not compiled for your Electron version.
**Fix**:

```bash
npm install --save-dev electron-rebuild
npx electron-rebuild -f -w better-sqlite3
```

### "Cannot find module 'better-sqlite3'"

**Cause**: npm install not run, or run from wrong directory.
**Fix**:

```bash
cd bigmart-pos-full && npm install
```

### "Cannot read properties of undefined (reading 'electronAPI')"

**Cause**: Angular running in browser (not Electron), or preload script not loading.
**Fix**: Always test Electron features by running `npm run dev`, not the browser.

### Angular hot-reload not working

**Cause**: Angular dev server not started, or Electron loaded wrong URL.
**Fix**: Run `npm run dev` (not `npm start`) — it starts both Angular and Electron.

### Database locked error

**Cause**: Two Electron instances running simultaneously.
**Fix**: Close all instances, run only one.

### "ng: command not found"

**Cause**: Angular CLI not installed globally.
**Fix**: `npm install -g @angular/cli`

### Windows: node-gyp build errors

**Cause**: Missing build tools for native modules.
**Fix**:

```bash
npm install --global --production windows-build-tools
# Then retry: npm install
```

---

## 15. CODE CONVENTIONS

### File naming

- Electron: `kebab-case.js` (e.g., `product.service.js`)
- Angular: `kebab-case.component.ts` (e.g., `product-form-dialog.component.ts`)
- Interfaces: `PascalCase` (e.g., `Product`, `SaleItem`)

### IPC channel naming

Pattern: `resource:action`

```
products:getAll      products:getById     products:create
products:update      products:delete      products:saveImage
sales:create         sales:getAll         sales:return
settings:getAll      settings:update
```

### Service method naming

```javascript
// Electron services
getAll(filters)        // SELECT multiple
getById(id)            // SELECT one by ID
create(data)           // INSERT
update(id, data)       // UPDATE
softDelete(id)         // is_active = 0
processReturn(...)     // Business action (more descriptive)
```

```typescript
// Angular services (same pattern)
getAll(filters?: any): Promise<Product[]>
getById(id: string): Promise<Product>
create(data: Partial<Product>): Promise<ApiResponse>
update(data: Partial<Product> & { id: string }): Promise<ApiResponse>
```

### State management

- **Global state** (user, settings, shift): Use `BehaviorSubject` in core services
- **Component state**: Use component properties + `async/await`
- **Lists**: Use `MatTableDataSource` for sortable/filterable tables
- **Forms**: Use `ReactiveFormsModule` (`FormBuilder`, `FormGroup`)

### Error handling

```typescript
// Always wrap Electron calls
async loadData() {
  try {
    this.loading = true;
    this.data = await this.electronService.getProducts();
  } catch (error) {
    this.notifications.error('Failed to load products');
    console.error(error);
  } finally {
    this.loading = false;
  }
}
```

---

## DEFAULT CREDENTIALS

| Role    | Username | Password   | PIN  | Access Level          |
| ------- | -------- | ---------- | ---- | --------------------- |
| Admin   | admin    | admin123   | 1234 | Everything            |
| Manager | manager  | manager123 | 2345 | Reports, Employees    |
| Cashier | cashier  | cashier123 | 5678 | POS, Sales, Inventory |

---

_Last updated: 2025 — BigMart POS v1.0.0_
