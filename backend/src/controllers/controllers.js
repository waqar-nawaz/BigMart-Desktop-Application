/**
 * electron/src/controllers/
 * ────────────────────────────
 * Controllers are thin. They:
 *   1. Receive arguments from IPC
 *   2. Validate / sanitise
 *   3. Call the service
 *   4. Return the result
 *
 * HOW TO ADD A NEW ENDPOINT:
 *   1. Add a method to the relevant controller below
 *   2. Register it in ipc/<feature>.ipc.js
 *   3. Expose it in electron/src/ipc/ipc.registry.js
 *   4. Add it to preload.js so Angular can call it
 */

const AuthService      = require('../services/auth.service');
const ProductService   = require('../services/product.service');
const SaleService      = require('../services/sale.service');
const { InventoryService, ReportService } = require('../services/services');
const { SettingService } = require('../services/services');
const { getDb } = require('../database/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');


// ─────────────────────────────────────────────────────────────
// AUTH CONTROLLER
// ─────────────────────────────────────────────────────────────
const AuthController = {
  login: (username, password)     => AuthService.loginWithPassword(username, password),
  pinLogin: (pin)                 => AuthService.loginWithPin(pin),
  changePassword: (id, old_, new_)=> AuthService.changePassword(id, old_, new_),
  getAllUsers: ()                  => AuthService.getAllUsers(),
  createUser: (data)              => AuthService.createUser(data),
  updateUser: (id, data)          => AuthService.updateUser(id, data),
};


// ─────────────────────────────────────────────────────────────
// PRODUCT CONTROLLER
// ─────────────────────────────────────────────────────────────
const ProductController = {
  getAll:       (filters)              => ProductService.getAll(filters),
  getById:      (id)                   => ProductService.getById(id),
  getByBarcode: (barcode)              => ProductService.getByBarcode(barcode),
  create:       (data)                 => ProductService.create(data),
  update:       (id, data)             => ProductService.update(id, data),
  delete:       (id)                   => ProductService.softDelete(id),
  saveImage:    (id, imgData, ext)     => ProductService.saveImage(id, imgData, ext),
  getImage:     (imgPath)              => ProductService.getImage(imgPath),
  bulkImport:   (filePath)             => ProductService.bulkImport(filePath),
  getLowStock:  ()                     => ProductService.getLowStock(),

  // Categories
  getAllCategories: () => {
    return getDb().prepare(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c LEFT JOIN products p ON c.id=p.category_id AND p.is_active=1
      WHERE c.is_active=1 GROUP BY c.id ORDER BY c.name
    `).all();
  },
  createCategory: (data) => {
    const id = uuidv4();
    getDb().prepare('INSERT INTO categories (id,name,description,color,icon) VALUES (?,?,?,?,?)')
      .run(id, data.name, data.description||null, data.color||'#4f9cf9', data.icon||'category');
    return { success: true, id };
  },
  updateCategory: (id, data) => {
    getDb().prepare('UPDATE categories SET name=?,description=?,color=?,icon=? WHERE id=?')
      .run(data.name, data.description||null, data.color, data.icon, id);
    return { success: true };
  },
};


// ─────────────────────────────────────────────────────────────
// SALE (POS) CONTROLLER
// ─────────────────────────────────────────────────────────────
const SaleController = {
  create:         (data)           => SaleService.create(data),
  getById:        (id)             => SaleService.getById(id),
  getAll:         (filters)        => SaleService.getAll(filters),
  processReturn:  (id, reason, items) => SaleService.processReturn(id, reason, items),
  generateReceipt:(id) => {
    const sale     = SaleService.getById(id);
    const settings = SettingService.getAll();
    return { sale, settings };
  },
};


// ─────────────────────────────────────────────────────────────
// CUSTOMER CONTROLLER
// ─────────────────────────────────────────────────────────────
const CustomerController = {
  getAll: (filters={}) => {
    const db = getDb();
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params=[];
    if(filters.search){sql+=' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';const q=`%${filters.search}%`;params.push(q,q,q);}
    if(filters.is_active!==undefined){sql+=' AND is_active=?';params.push(filters.is_active);}
    sql+=' ORDER BY name ASC';
    return db.prepare(sql).all(...params);
  },
  getById: (id)     => getDb().prepare('SELECT * FROM customers WHERE id=?').get(id),
  getByPhone: (phone)=> getDb().prepare('SELECT * FROM customers WHERE phone=?').get(phone),
  create: (data) => {
    const id = uuidv4();
    getDb().prepare(`INSERT INTO customers
      (id,name,email,phone,address,city,customer_type,date_of_birth,notes)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, data.name, data.email||null, data.phone||null, data.address||null,
        data.city||null, data.customer_type||'regular', data.date_of_birth||null, data.notes||null);
    return { success: true, id };
  },
  update: (id, data) => {
    getDb().prepare(`UPDATE customers SET name=?,email=?,phone=?,address=?,city=?,
      customer_type=?,date_of_birth=?,notes=?,updated_at=datetime('now') WHERE id=?`)
      .run(data.name, data.email||null, data.phone||null, data.address||null,
        data.city||null, data.customer_type, data.date_of_birth||null, data.notes||null, id);
    return { success: true };
  },
  getPurchaseHistory: (customerId) => {
    return getDb().prepare(`
      SELECT s.*,COUNT(si.id) AS item_count FROM sales s
      LEFT JOIN sale_items si ON s.id=si.sale_id
      WHERE s.customer_id=? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 50
    `).all(customerId);
  },
};


// ─────────────────────────────────────────────────────────────
// INVENTORY CONTROLLER
// ─────────────────────────────────────────────────────────────
const InventoryController = {
  adjust:         (data)    => InventoryService.adjustStock(data),
  getAdjustments: (filters) => InventoryService.getAdjustments(filters),
};


// ─────────────────────────────────────────────────────────────
// PURCHASE CONTROLLER
// ─────────────────────────────────────────────────────────────
const PurchaseController = {
  create: (data) => {
    const db = getDb();
    const id = uuidv4();
    // Generate PO number
    const prefix = SettingService.get('po_prefix') || 'PO';
    const today  = dayjs().format('YYYYMMDD');
    const last   = db.prepare("SELECT po_number FROM purchases ORDER BY created_at DESC LIMIT 1").get();
    let seq = 1;
    if (last) { const m = last.po_number.match(/(\d+)$/); if (m) seq = parseInt(m[1]) + 1; }
    const poNumber = `${prefix}-${today}-${String(seq).padStart(4,'0')}`;

    db.transaction(() => {
      db.prepare(`INSERT INTO purchases
        (id,po_number,supplier_id,expected_date,status,subtotal,tax_amount,total_amount,notes,created_by)
        VALUES (?,?,?,?,'pending',?,?,?,?,?)`)
        .run(id, poNumber, data.supplier_id, data.expected_date||null,
          data.subtotal, data.tax_amount||0, data.total_amount, data.notes||null, data.created_by||null);

      data.items.forEach(item => {
        db.prepare(`INSERT INTO purchase_items
          (id,purchase_id,product_id,product_name,quantity_ordered,unit_cost,total_cost)
          VALUES (?,?,?,?,?,?,?)`)
          .run(uuidv4(), id, item.product_id, item.product_name,
            item.quantity_ordered, item.unit_cost, item.total_cost);
      });
    })();
    return { success: true, id, poNumber };
  },

  receive: (purchaseId, items, receivedDate) => {
    const db = getDb();
    db.transaction(() => {
      items.forEach(item => {
        db.prepare('UPDATE purchase_items SET quantity_received=? WHERE id=?').run(item.quantity_received, item.id);
        db.prepare('UPDATE products SET stock_quantity=stock_quantity+?,cost_price=?,updated_at=datetime("now") WHERE id=?')
          .run(item.quantity_received, item.unit_cost, item.product_id);
      });
      const allItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id=?').all(purchaseId);
      const status = allItems.every(i => i.quantity_received >= i.quantity_ordered) ? 'received' : 'partial';
      db.prepare("UPDATE purchases SET status=?,received_date=?,updated_at=datetime('now') WHERE id=?")
        .run(status, receivedDate || dayjs().toISOString(), purchaseId);
    })();
    return { success: true };
  },

  getAll: (filters={}) => {
    const db = getDb();
    let sql=`SELECT p.*,s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE 1=1`;
    const params=[];
    if(filters.status){sql+=' AND p.status=?';params.push(filters.status);}
    if(filters.supplier_id){sql+=' AND p.supplier_id=?';params.push(filters.supplier_id);}
    sql+=' ORDER BY p.created_at DESC';
    return db.prepare(sql).all(...params);
  },

  getById: (id) => {
    const db = getDb();
    const po = db.prepare(`SELECT p.*,s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.id=?`).get(id);
    if (po) po.items = db.prepare(`SELECT pi.*,pr.barcode FROM purchase_items pi LEFT JOIN products pr ON pi.product_id=pr.id WHERE pi.purchase_id=?`).all(id);
    return po;
  },
};


// ─────────────────────────────────────────────────────────────
// SUPPLIER CONTROLLER
// ─────────────────────────────────────────────────────────────
const SupplierController = {
  getAll: (filters={}) => {
    const db=getDb(); let sql='SELECT * FROM suppliers WHERE 1=1'; const params=[];
    if(filters.search){sql+=' AND (name LIKE ? OR contact_person LIKE ?)';const q=`%${filters.search}%`;params.push(q,q);}
    if(filters.is_active!==undefined){sql+=' AND is_active=?';params.push(filters.is_active);}
    sql+=' ORDER BY name ASC'; return db.prepare(sql).all(...params);
  },
  create: (data) => {
    const id=uuidv4();
    getDb().prepare('INSERT INTO suppliers (id,name,contact_person,email,phone,address,city,tax_number,payment_terms,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id,data.name,data.contact_person||null,data.email||null,data.phone||null,data.address||null,data.city||null,data.tax_number||null,data.payment_terms||30,data.notes||null);
    return { success:true, id };
  },
  update: (id, data) => {
    getDb().prepare(`UPDATE suppliers SET name=?,contact_person=?,email=?,phone=?,address=?,city=?,tax_number=?,payment_terms=?,notes=?,updated_at=datetime('now') WHERE id=?`)
      .run(data.name,data.contact_person||null,data.email||null,data.phone||null,data.address||null,data.city||null,data.tax_number||null,data.payment_terms||30,data.notes||null,id);
    return { success:true };
  },
};


// ─────────────────────────────────────────────────────────────
// SHIFT CONTROLLER
// ─────────────────────────────────────────────────────────────
const ShiftController = {
  open: (cashierId, openingCash) => {
    const id=uuidv4();
    getDb().prepare("INSERT INTO shifts (id,cashier_id,start_time,opening_cash,status) VALUES (?,?,datetime('now'),?,'open')")
      .run(id, cashierId, openingCash);
    return { success:true, shiftId:id };
  },
  close: (shiftId, closingCash, notes) => {
    getDb().prepare("UPDATE shifts SET end_time=datetime('now'),closing_cash=?,status='closed',notes=? WHERE id=?")
      .run(closingCash, notes||null, shiftId);
    return { success:true };
  },
  getActive: (cashierId) => getDb().prepare("SELECT * FROM shifts WHERE cashier_id=? AND status='open' ORDER BY start_time DESC LIMIT 1").get(cashierId),
  getAll: () => getDb().prepare(`SELECT s.*,u.full_name AS cashier_name FROM shifts s LEFT JOIN users u ON s.cashier_id=u.id ORDER BY s.start_time DESC LIMIT 50`).all(),
};


// ─────────────────────────────────────────────────────────────
// EXPENSE CONTROLLER
// ─────────────────────────────────────────────────────────────
const ExpenseController = {
  getAll: (filters={}) => {
    const db=getDb(); let sql=`SELECT e.*,u.full_name AS recorded_by_name FROM expenses e LEFT JOIN users u ON e.recorded_by=u.id WHERE 1=1`;const params=[];
    if(filters.date_from){sql+=' AND date(e.expense_date)>=?';params.push(filters.date_from);}
    if(filters.date_to){sql+=' AND date(e.expense_date)<=?';params.push(filters.date_to);}
    sql+=' ORDER BY e.expense_date DESC'; return db.prepare(sql).all(...params);
  },
  create: (data) => {
    const id=uuidv4();
    getDb().prepare('INSERT INTO expenses (id,category,amount,description,expense_date,payment_method,reference,recorded_by) VALUES (?,?,?,?,?,?,?,?)')
      .run(id,data.category,data.amount,data.description||null,data.expense_date||dayjs().toISOString(),data.payment_method||'cash',data.reference||null,data.recorded_by||null);
    return { success:true, id };
  },
};


// ─────────────────────────────────────────────────────────────
// REPORT CONTROLLER
// ─────────────────────────────────────────────────────────────
let app;
try { app = require('electron').app; } 
catch (e) { app = { getPath: () => require('os').tmpdir(), getVersion: () => 'standalone' }; }
const path     = require('path');
const reportsPath = path.join(app.getPath('userData'), 'reports');
const fs = require('fs');
if (!fs.existsSync(reportsPath)) fs.mkdirSync(reportsPath, { recursive: true });

const ReportController = {
  getSalesSummary: (dateFrom, dateTo) => ReportService.getSalesSummary(dateFrom, dateTo),
  exportExcel:     (type)             => ReportService.exportToExcel(type, reportsPath),

  getDashboardStats: (period='today') => {
    const db = getDb();
    let dateFilter;
    if(period==='today')  dateFilter="date(sale_date)=date('now')";
    else if(period==='week')  dateFilter="sale_date>=date('now','-7 days')";
    else if(period==='month') dateFilter="sale_date>=date('now','-30 days')";
    else dateFilter='1=1';

    return {
      todaySales:    db.prepare(`SELECT COALESCE(SUM(total_amount),0) AS total,COUNT(*) AS count FROM sales WHERE ${dateFilter} AND status='completed'`).get(),
      totalProducts: db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active=1').get(),
      lowStockCount: db.prepare('SELECT COUNT(*) AS count FROM products WHERE stock_quantity<=min_stock_level AND is_active=1').get(),
      totalCustomers:db.prepare('SELECT COUNT(*) AS count FROM customers WHERE is_active=1').get(),
      pendingPOs:    db.prepare("SELECT COUNT(*) AS count FROM purchases WHERE status IN ('pending','partial')").get(),
      totalExpenses: db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE ${dateFilter.replace('sale_date','expense_date')}`).get(),
      topProducts:   db.prepare(`SELECT p.name,SUM(si.quantity) AS qty_sold,SUM(si.total_price) AS revenue FROM sale_items si JOIN products p ON si.product_id=p.id JOIN sales s ON si.sale_id=s.id WHERE ${dateFilter} AND s.status='completed' GROUP BY p.id ORDER BY qty_sold DESC LIMIT 10`).all(),
      salesByHour:   db.prepare(`SELECT strftime('%H',sale_date) AS hour,SUM(total_amount) AS total FROM sales WHERE date(sale_date)=date('now') AND status='completed' GROUP BY hour ORDER BY hour`).all(),
      recentSales:   db.prepare(`SELECT s.*,c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id=c.id WHERE s.status='completed' ORDER BY s.created_at DESC LIMIT 10`).all(),
      categoryRevenue:db.prepare(`SELECT cat.name,cat.color,SUM(si.total_price) AS revenue FROM sale_items si JOIN products p ON si.product_id=p.id JOIN categories cat ON p.category_id=cat.id JOIN sales s ON si.sale_id=s.id WHERE ${dateFilter} AND s.status='completed' GROUP BY cat.id ORDER BY revenue DESC`).all(),
    };
  },
};


// ─────────────────────────────────────────────────────────────
// SETTINGS CONTROLLER
// ─────────────────────────────────────────────────────────────
const SettingsController = {
  getAll:  ()         => SettingService.getAll(),
  update:  (settings) => SettingService.updateMany(settings),
};


// ─────────────────────────────────────────────────────────────
// BACKUP CONTROLLER
// ─────────────────────────────────────────────────────────────
const { getDb: _getDb } = require('../database/database');
const backupsPath = path.join(app.getPath('userData'), 'backups');
if (!fs.existsSync(backupsPath)) fs.mkdirSync(backupsPath, { recursive: true });

const BackupController = {
  create: () => {
    const filename  = `bigmart_backup_${dayjs().format('YYYY-MM-DD_HH-mm')}.db`;
    const backupPath = path.join(backupsPath, filename);
    _getDb().backup(backupPath);
    return { success: true, path: backupPath };
  },
  listBackups: () => {
    return fs.readdirSync(backupsPath).map(f => ({
      name: f, path: path.join(backupsPath, f),
      size: fs.statSync(path.join(backupsPath, f)).size,
      date: fs.statSync(path.join(backupsPath, f)).mtime
    })).sort((a, b) => b.date - a.date);
  },
};


// ─────────────────────────────────────────────────────────────
// SYSTEM CONTROLLER
// ─────────────────────────────────────────────────────────────
let shell;
try { shell = require('electron').shell; } 
catch (e) { shell = { openPath: () => {} }; }
const SystemController = {
  getInfo: () => ({
    appVersion:   app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion:  process.versions.node,
    platform:     process.platform,
    dbPath:       path.join(app.getPath('userData'), 'bigmart.db'),
    userDataPath: app.getPath('userData'),
  }),
  openDataFolder:    () => shell.openPath(app.getPath('userData')),
  openReportsFolder: () => shell.openPath(reportsPath),
};


module.exports = {
  AuthController, ProductController, SaleController, CustomerController,
  InventoryController, PurchaseController, SupplierController,
  ShiftController, ExpenseController, ReportController,
  SettingsController, BackupController, SystemController,
};
