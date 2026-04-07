/**
 * electron/src/database/database.js
 * ───────────────────────────────────
 * Single SQLite3 connection (better-sqlite3, synchronous API).
 * Exports: initDatabase(), getDb()
 *
 * HOW TO ADD A NEW TABLE:
 *   1. Add CREATE TABLE IF NOT EXISTS block inside createSchema()
 *   2. Add any seed data in seedData()
 *   3. Done — the schema runs once on startup
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

let app = null;
try {
  app = require('electron').app; // Only available in Electron
} catch (e) {
  app = null; // Running standalone (start-api.js)
}

const logger = require('../utils/logger');
const { seedData } = require('./seed');

let db = null;

// ─── Paths ────────────────────────────────────────────────────
function getDbPath() {
  let userDataPath;

  if (app && typeof app.getPath === 'function') {
    userDataPath = app.getPath('userData'); // Electron mode
  } else {
    userDataPath = path.join(os.homedir(), '.config', 'bigmart-pos'); // Standalone mode
  }

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  return path.join(userDataPath, 'bigmart.db');
}

// ─── Init ─────────────────────────────────────────────────────
function initDatabase() {
  const dbPath = getDbPath();
  logger.info(`Database path: ${dbPath}`);

  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');   // Better concurrent read performance
  db.pragma('foreign_keys = ON');    // Enforce FK constraints
  db.pragma('synchronous = NORMAL'); // Balance between speed and safety
  db.pragma('cache_size = -64000');  // 64 MB cache

  createSchema();
  seedData(db);

  logger.info('Database ready');
  return db;
}

/** Returns the open database connection. Call after initDatabase(). */
function getDb() { return db; }

// ─── Schema ───────────────────────────────────────────────────
function createSchema() {
  db.exec(`
    /* ── Users / Employees ─────────────────────────── */
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name     TEXT NOT NULL,
      email         TEXT,
      role          TEXT NOT NULL DEFAULT 'cashier', -- admin | manager | cashier
      pin           TEXT,
      is_active     INTEGER DEFAULT 1,
      last_login    TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    /* ── Categories ────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT DEFAULT '#4f9cf9',
      icon        TEXT DEFAULT 'category',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    /* ── Suppliers ─────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS suppliers (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      contact_person TEXT,
      email          TEXT,
      phone          TEXT,
      address        TEXT,
      city           TEXT,
      tax_number     TEXT,
      payment_terms  INTEGER DEFAULT 30,
      is_active      INTEGER DEFAULT 1,
      notes          TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    /* ── Products ──────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS products (
      id              TEXT PRIMARY KEY,
      barcode         TEXT UNIQUE,
      name            TEXT NOT NULL,
      description     TEXT,
      category_id     TEXT REFERENCES categories(id),
      supplier_id     TEXT REFERENCES suppliers(id),
      unit            TEXT DEFAULT 'pcs',
      cost_price      REAL DEFAULT 0,
      selling_price   REAL NOT NULL,
      discount_price  REAL,
      tax_rate        REAL DEFAULT 0,
      stock_quantity  REAL DEFAULT 0,
      min_stock_level REAL DEFAULT 10,
      max_stock_level REAL DEFAULT 1000,
      reorder_point   REAL DEFAULT 20,
      image_path      TEXT,
      is_active       INTEGER DEFAULT 1,
      is_featured     INTEGER DEFAULT 0,
      expiry_date     TEXT,
      location        TEXT,
      weight          REAL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    /* ── Customers ─────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS customers (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT,
      phone           TEXT UNIQUE,
      address         TEXT,
      city            TEXT,
      loyalty_points  INTEGER DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      customer_type   TEXT DEFAULT 'regular', -- regular | vip | wholesale | staff
      date_of_birth   TEXT,
      is_active       INTEGER DEFAULT 1,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    /* ── Sales (Invoices) ──────────────────────────── */
    CREATE TABLE IF NOT EXISTS sales (
      id                   TEXT PRIMARY KEY,
      invoice_number       TEXT UNIQUE NOT NULL,
      customer_id          TEXT REFERENCES customers(id),
      cashier_id           TEXT REFERENCES users(id),
      shift_id             TEXT REFERENCES shifts(id),
      sale_date            TEXT DEFAULT (datetime('now')),
      subtotal             REAL NOT NULL,
      discount_amount      REAL DEFAULT 0,
      discount_type        TEXT DEFAULT 'fixed',   -- fixed | percent
      tax_amount           REAL DEFAULT 0,
      total_amount         REAL NOT NULL,
      paid_amount          REAL NOT NULL,
      change_amount        REAL DEFAULT 0,
      payment_method       TEXT DEFAULT 'cash',    -- cash | card | mobile | credit
      payment_reference    TEXT,
      status               TEXT DEFAULT 'completed', -- completed | returned | void
      notes                TEXT,
      is_returned          INTEGER DEFAULT 0,
      return_reason        TEXT,
      loyalty_points_earned INTEGER DEFAULT 0,
      loyalty_points_used  INTEGER DEFAULT 0,
      created_at           TEXT DEFAULT (datetime('now'))
    );

    /* ── Sale Items ─────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS sale_items (
      id              TEXT PRIMARY KEY,
      sale_id         TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id      TEXT REFERENCES products(id),
      product_name    TEXT NOT NULL,
      barcode         TEXT,
      quantity        REAL NOT NULL,
      unit_price      REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount      REAL DEFAULT 0,
      total_price     REAL NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    /* ── Purchase Orders ────────────────────────────── */
    CREATE TABLE IF NOT EXISTS purchases (
      id              TEXT PRIMARY KEY,
      po_number       TEXT UNIQUE NOT NULL,
      supplier_id     TEXT REFERENCES suppliers(id),
      order_date      TEXT DEFAULT (datetime('now')),
      expected_date   TEXT,
      received_date   TEXT,
      status          TEXT DEFAULT 'pending', -- pending | partial | received | cancelled
      subtotal        REAL DEFAULT 0,
      tax_amount      REAL DEFAULT 0,
      total_amount    REAL DEFAULT 0,
      paid_amount     REAL DEFAULT 0,
      payment_status  TEXT DEFAULT 'unpaid',  -- unpaid | partial | paid
      notes           TEXT,
      created_by      TEXT REFERENCES users(id),
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    /* ── Purchase Items ─────────────────────────────── */
    CREATE TABLE IF NOT EXISTS purchase_items (
      id                TEXT PRIMARY KEY,
      purchase_id       TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id        TEXT REFERENCES products(id),
      product_name      TEXT NOT NULL,
      quantity_ordered  REAL NOT NULL,
      quantity_received REAL DEFAULT 0,
      unit_cost         REAL NOT NULL,
      total_cost        REAL NOT NULL,
      created_at        TEXT DEFAULT (datetime('now'))
    );

    /* ── Stock Adjustments ──────────────────────────── */
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id                  TEXT PRIMARY KEY,
      product_id          TEXT REFERENCES products(id),
      product_name        TEXT NOT NULL,
      adjustment_type     TEXT NOT NULL, -- add | remove | set | damage
      quantity_before     REAL NOT NULL,
      adjustment_quantity REAL NOT NULL,
      quantity_after      REAL NOT NULL,
      reason              TEXT,
      adjusted_by         TEXT REFERENCES users(id),
      created_at          TEXT DEFAULT (datetime('now'))
    );

    /* ── Shifts ─────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS shifts (
      id                 TEXT PRIMARY KEY,
      cashier_id         TEXT REFERENCES users(id),
      start_time         TEXT NOT NULL,
      end_time           TEXT,
      opening_cash       REAL DEFAULT 0,
      closing_cash       REAL,
      total_sales        REAL DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      status             TEXT DEFAULT 'open', -- open | closed
      notes              TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    /* ── Expenses ───────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS expenses (
      id             TEXT PRIMARY KEY,
      category       TEXT NOT NULL,
      amount         REAL NOT NULL,
      description    TEXT,
      expense_date   TEXT DEFAULT (datetime('now')),
      payment_method TEXT DEFAULT 'cash',
      reference      TEXT,
      recorded_by    TEXT REFERENCES users(id),
      created_at     TEXT DEFAULT (datetime('now'))
    );

    /* ── Loyalty Transactions ───────────────────────── */
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id               TEXT PRIMARY KEY,
      customer_id      TEXT REFERENCES customers(id),
      sale_id          TEXT,
      points           INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,  -- earned | redeemed
      description      TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    /* ── App Settings (Key-Value) ───────────────────── */
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    /* ── Audit Log ──────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS audit_log (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      action     TEXT NOT NULL,
      table_name TEXT,
      record_id  TEXT,
      old_values TEXT,
      new_values TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    /* ── Invoice Sequences (Atomic Counter) ──────────── */
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      date_key   TEXT PRIMARY KEY,  -- Format: YYYY-MM-DD
      next_seq   INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Useful indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date          ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_cashier       ON sales(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_po   ON purchase_items(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone     ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_stock_adj_product   ON stock_adjustments(product_id);
  `);
}

module.exports = { initDatabase, getDb };
