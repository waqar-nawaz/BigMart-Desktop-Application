/**
 * electron/src/database/seed.js
 * ────────────────────────────────
 * Seeds default users, categories, one supplier, sample products
 * and default app settings — runs only if the DB is empty.
 *
 * HOW TO ADD SEED DATA:
 *   - Add entries to the arrays below (categories, products, etc.)
 *   - The function is idempotent — it checks `users` count first.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

function seedData(db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) return; // Already seeded

  console.log('[Seed] Seeding default data…');

  // ── Users ─────────────────────────────────────────────
  const users = [
    { username: 'admin', password: 'admin123', role: 'admin', full_name: 'System Admin', pin: '1234' },
    { username: 'manager', password: 'manager123', role: 'manager', full_name: 'Store Manager', pin: '2345' },
    { username: 'cashier', password: 'cashier123', role: 'cashier', full_name: 'John Cashier', pin: '5678' },
    { username: 'supervisor', password: 'super123', role: 'supervisor', full_name: 'Sarah Supervisor', pin: '3456' },
    { username: 'accountant', password: 'account123', role: 'accountant', full_name: 'Mike Accountant', pin: '4567' },
  ];

  const userStmt = db.prepare(
    'INSERT INTO users (id, username, password_hash, full_name, role, pin) VALUES (?, ?, ?, ?, ?, ?)'
  );
  users.forEach(u => {
    userStmt.run(uuidv4(), u.username, bcrypt.hashSync(u.password, 10), u.full_name, u.role, u.pin);
  });

  // ── Categories ────────────────────────────────────────
  const categories = [
    { name: 'Beverages', color: '#2196F3', icon: 'local_drink' },
    { name: 'Bakery', color: '#FF9800', icon: 'bakery_dining' },
    { name: 'Dairy & Eggs', color: '#4CAF50', icon: 'egg' },
    { name: 'Snacks', color: '#9C27B0', icon: 'lunch_dining' },
    { name: 'Frozen Foods', color: '#00BCD4', icon: 'ac_unit' },
    { name: 'Personal Care', color: '#E91E63', icon: 'spa' },
    { name: 'Household', color: '#607D8B', icon: 'home' },
    { name: 'Meat & Seafood', color: '#F44336', icon: 'set_meal' },
    { name: 'Fruits & Vegetables', color: '#8BC34A', icon: 'eco' },
    { name: 'Canned & Dry Goods', color: '#795548', icon: 'inventory_2' },
  ];

  const catStmt = db.prepare(
    'INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)'
  );
  const catIds = {};
  categories.forEach(c => {
    const id = uuidv4();
    catStmt.run(id, c.name, c.color, c.icon);
    catIds[c.name] = id;
  });

  // ── Supplier ──────────────────────────────────────────
  const supplierId = uuidv4();
  db.prepare(
    'INSERT INTO suppliers (id, name, contact_person, email, phone, city, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(supplierId, 'BigMart Wholesale Ltd', 'Ahmed Khan', 'supply@bigmart.com', '03001234567', 'Karachi', 30);

  // ── Products ──────────────────────────────────────────
  const products = [
    { barcode: '5000112637922', name: 'Coca-Cola 1.5L', cat: 'Beverages', cost: 80, price: 120, stock: 150 },
    { barcode: '8901030784315', name: 'Pepsi 1L', cat: 'Beverages', cost: 65, price: 100, stock: 120 },
    { barcode: '5449000131805', name: 'Water Bottle 500ml', cat: 'Beverages', cost: 20, price: 35, stock: 300 },
    { barcode: '8901030785534', name: 'Lays Classic 100g', cat: 'Snacks', cost: 45, price: 70, stock: 80 },
    { barcode: '6111020101012', name: 'Bread Loaf 700g', cat: 'Bakery', cost: 55, price: 85, stock: 40 },
    { barcode: '8888000000001', name: 'Fresh Milk 1L', cat: 'Dairy & Eggs', cost: 90, price: 135, stock: 60 },
    { barcode: '8888000000002', name: 'Cheddar Cheese 200g', cat: 'Dairy & Eggs', cost: 180, price: 280, stock: 30 },
    { barcode: '8888000000003', name: 'Eggs Tray (30 pcs)', cat: 'Dairy & Eggs', cost: 350, price: 480, stock: 25 },
    { barcode: '8888000000004', name: 'Chicken Breast 1kg', cat: 'Meat & Seafood', cost: 350, price: 500, stock: 20 },
    { barcode: '8888000000005', name: 'Shampoo 400ml', cat: 'Personal Care', cost: 200, price: 320, stock: 45 },
    { barcode: '8888000000006', name: 'Tomatoes 1kg', cat: 'Fruits & Vegetables', cost: 60, price: 100, stock: 8 },
    { barcode: '8888000000007', name: 'Bananas 1kg', cat: 'Fruits & Vegetables', cost: 80, price: 120, stock: 35 },
    { barcode: '8888000000008', name: 'Dishwash Liquid 500ml', cat: 'Household', cost: 90, price: 150, stock: 55 },
    { barcode: '8888000000009', name: 'Tuna Can 185g', cat: 'Canned & Dry Goods', cost: 110, price: 170, stock: 70 },
    { barcode: '8888000000010', name: 'Ice Cream 1L', cat: 'Frozen Foods', cost: 220, price: 340, stock: 18 },
  ];

  const prodStmt = db.prepare(`
    INSERT INTO products
      (id, barcode, name, category_id, supplier_id, cost_price, selling_price, stock_quantity, min_stock_level, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  products.forEach(p => {
    prodStmt.run(uuidv4(), p.barcode, p.name, catIds[p.cat], supplierId,
      p.cost, p.price, p.stock, 15, 'pcs');
  });

  // ── Settings ──────────────────────────────────────────
  const defaultSettings = {
    store_name: 'BigMart Superstore',
    store_address: '123 Main Street, Karachi',
    store_phone: '021-1234567',
    store_email: 'info@bigmart.com',
    store_ntn: '1234567-8',
    currency: 'PKR',
    currency_symbol: 'Rs.',
    tax_rate: '0',
    loyalty_rate: '1',
    loyalty_redemption: '100',
    receipt_footer: 'Thank you for shopping at BigMart!',
    low_stock_threshold: '15',
    invoice_prefix: 'BM',
    po_prefix: 'PO',
    printer_enabled: 'false',
    printer_interface: 'usb',
    printer_ip: '',
    printer_port: '9100',
    backup_enabled: 'true',
    backup_frequency: 'daily',
    theme: 'dark',
    language: 'en',
  };

  const settingStmt = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  Object.entries(defaultSettings).forEach(([k, v]) => settingStmt.run(k, v));

  console.log('[Seed] Default data seeded ✓');
}

module.exports = { seedData };
