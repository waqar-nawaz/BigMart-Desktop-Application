/**
 * electron/src/models/user.model.js
 */
const BaseModel = require('./base.model');

class UserModel extends BaseModel {
  constructor() { super('users'); }

  findByUsername(username) {
    return this.queryOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  }

  findByPin(pin) {
    return this.queryOne('SELECT * FROM users WHERE pin = ? AND is_active = 1', [pin]);
  }

  findAllSafe() {
    // Never return password_hash to the UI
    return this.query(
      'SELECT id, username, full_name, email, role, pin, is_active, last_login, created_at FROM users ORDER BY full_name'
    );
  }

  updateLastLogin(id) {
    return this.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [id]);
  }

  updatePassword(id, hash) {
    return this.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, id]);
  }
}

module.exports.UserModel = new UserModel();


/**
 * electron/src/models/customer.model.js
 */
class CustomerModel extends BaseModel {
  constructor() { super('customers'); }

  findWithFilters(filters = {}) {
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (filters.search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }
    if (filters.is_active !== undefined) { sql += ' AND is_active = ?'; params.push(filters.is_active); }
    if (filters.customer_type) { sql += ' AND customer_type = ?'; params.push(filters.customer_type); }
    sql += ' ORDER BY name ASC';
    return this.query(sql, params);
  }

  findByPhone(phone) {
    return this.queryOne('SELECT * FROM customers WHERE phone = ?', [phone]);
  }

  addLoyaltyPoints(id, points, totalSpent) {
    return this.run(
      'UPDATE customers SET loyalty_points = loyalty_points + ?, total_purchases = total_purchases + ? WHERE id = ?',
      [points, totalSpent, id]
    );
  }

  redeemLoyaltyPoints(id, points) {
    return this.run(
      'UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?',
      [points, id]
    );
  }

  getPurchaseHistory(customerId) {
    return this.query(`
      SELECT s.*, COUNT(si.id) AS item_count
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.customer_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 50
    `, [customerId]);
  }
}

module.exports.CustomerModel = new CustomerModel();


/**
 * electron/src/models/sale.model.js
 */
class SaleModel extends BaseModel {
  constructor() { super('sales'); }

  findWithRelations(filters = {}) {
    let sql = `
      SELECT s.*,
             c.name       AS customer_name,
             u.full_name  AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users     u ON s.cashier_id  = u.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.date_from) { sql += ' AND date(s.sale_date) >= ?'; params.push(filters.date_from); }
    if (filters.date_to) { sql += ' AND date(s.sale_date) <= ?'; params.push(filters.date_to); }
    if (filters.cashier_id) { sql += ' AND s.cashier_id = ?'; params.push(filters.cashier_id); }
    if (filters.payment_method) { sql += ' AND s.payment_method = ?'; params.push(filters.payment_method); }
    if (filters.status) { sql += ' AND s.status = ?'; params.push(filters.status); }
    if (filters.search) {
      sql += ' AND (s.invoice_number LIKE ? OR c.name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    sql += ' ORDER BY s.created_at DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
    return this.query(sql, params);
  }

  findByIdWithItems(id) {
    const sale = this.queryOne(`
      SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users     u ON s.cashier_id  = u.id
      WHERE s.id = ?
    `, [id]);
    if (sale) {
      sale.items = this.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    }
    return sale;
  }

  getLastInvoiceNumber() {
    return this.queryOne('SELECT invoice_number FROM sales ORDER BY created_at DESC LIMIT 1');
  }

  getDailyStats(dateFilter) {
    return this.queryOne(`
      SELECT COALESCE(SUM(total_amount), 0) AS total,
             COUNT(*) AS count
      FROM sales WHERE ${dateFilter} AND status = 'completed'
    `);
  }

  getDailyTrend(dateFrom, dateTo) {
    return this.query(`
      SELECT date(sale_date) AS date,
             COUNT(*)        AS transactions,
             SUM(total_amount)    AS revenue,
             SUM(discount_amount) AS discounts
      FROM sales
      WHERE date(sale_date) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY date ORDER BY date
    `, [dateFrom, dateTo]);
  }

  getSalesByHour(dateFilter) {
    return this.query(`
      SELECT strftime('%H', sale_date) AS hour,
             SUM(total_amount)         AS total
      FROM sales
      WHERE ${dateFilter} AND status = 'completed'
      GROUP BY hour ORDER BY hour
    `);
  }

  getPaymentMethodBreakdown(dateFrom, dateTo) {
    return this.query(`
      SELECT payment_method,
             COUNT(*)              AS count,
             SUM(total_amount)     AS total,
             SUM(discount_amount)  AS discounts,
             SUM(tax_amount)       AS taxes
      FROM sales
      WHERE date(sale_date) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY payment_method
    `, [dateFrom, dateTo]);
  }
}

module.exports.SaleModel = new SaleModel();


/**
 * electron/src/models/purchase.model.js
 */
class PurchaseModel extends BaseModel {
  constructor() { super('purchases'); }

  findWithSupplier(filters = {}) {
    let sql = `
      SELECT p.*, s.name AS supplier_name
      FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.status) { sql += ' AND p.status = ?'; params.push(filters.status); }
    if (filters.supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(filters.supplier_id); }
    sql += ' ORDER BY p.created_at DESC';
    return this.query(sql, params);
  }

  findByIdWithItems(id) {
    const po = this.queryOne(`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [id]);
    if (po) {
      po.items = this.query(`
        SELECT pi.*, pr.barcode
        FROM purchase_items pi LEFT JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = ?
      `, [id]);
    }
    return po;
  }

  getLastPoNumber() {
    return this.queryOne('SELECT po_number FROM purchases ORDER BY created_at DESC LIMIT 1');
  }
}

module.exports.PurchaseModel = new PurchaseModel();


/**
 * electron/src/models/supplier.model.js
 */
class SupplierModel extends BaseModel {
  constructor() { super('suppliers'); }

  findWithFilters(filters = {}) {
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];
    if (filters.search) {
      sql += ' AND (name LIKE ? OR contact_person LIKE ? OR city LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }
    if (filters.is_active !== undefined) { sql += ' AND is_active = ?'; params.push(filters.is_active); }
    sql += ' ORDER BY name ASC';
    return this.query(sql, params);
  }
}

module.exports.SupplierModel = new SupplierModel();


/**
 * electron/src/models/category.model.js
 */
class CategoryModel extends BaseModel {
  constructor() { super('categories'); }

  findAllWithCount() {
    return this.query(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id ORDER BY c.name
    `);
  }
}

module.exports.CategoryModel = new CategoryModel();
