
const { getDb } = require('../database/database');

module.exports = {};

/**
 * electron/src/services/inventory.service.js
 */
const InventoryService = {
  adjustStock(data) {
    const { v4: uuid } = require('uuid');
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(data.product_id);
    if (!product) return { success: false, message: 'Product not found' };
    const newQty = product.stock_quantity + data.adjustment_quantity;
    db.prepare('UPDATE products SET stock_quantity=? WHERE id=?').run(newQty, data.product_id);
    db.prepare(`INSERT INTO stock_adjustments
      (id,product_id,product_name,adjustment_type,quantity_before,adjustment_quantity,quantity_after,reason,adjusted_by)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(uuid(), data.product_id, product.name, data.type, product.stock_quantity,
      data.adjustment_quantity, newQty, data.reason, data.adjusted_by || null);
    return { success: true };
  },

  getAdjustments(filters = {}) {
    const db = getDb();
    let sql = `SELECT sa.*,u.full_name AS adjusted_by_name FROM stock_adjustments sa LEFT JOIN users u ON sa.adjusted_by=u.id WHERE 1=1`;
    const params = [];
    if (filters.product_id) { sql += ' AND sa.product_id=?'; params.push(filters.product_id); }
    if (filters.date_from) { sql += ' AND date(sa.created_at)>=?'; params.push(filters.date_from); }
    sql += ' ORDER BY sa.created_at DESC LIMIT 200';
    return db.prepare(sql).all(...params);
  },
};

module.exports.InventoryService = InventoryService;


/**
 * electron/src/services/setting.service.js
 */
const SettingService = require('./setting.service');

module.exports.SettingService = SettingService;


/**
 * electron/src/services/report.service.js
 */
const path = require('path');
const XLSX = require('xlsx');
const dayjs = require('dayjs');

const ReportService = {
  getSalesSummary(dateFrom, dateTo) {
    const db = getDb();
    const paymentBreakdown = db.prepare(`
      SELECT payment_method,COUNT(*) AS count,SUM(total_amount) AS total,
             SUM(discount_amount) AS discounts,SUM(tax_amount) AS taxes
      FROM sales WHERE date(sale_date) BETWEEN ? AND ? AND status='completed'
      GROUP BY payment_method
    `).all(dateFrom, dateTo);

    const dailyTrend = db.prepare(`
      SELECT date(sale_date) AS date,COUNT(*) AS transactions,
             SUM(total_amount) AS revenue,SUM(discount_amount) AS discounts
      FROM sales WHERE date(sale_date) BETWEEN ? AND ? AND status='completed'
      GROUP BY date ORDER BY date
    `).all(dateFrom, dateTo);

    const topProducts = db.prepare(`
      SELECT p.name,p.barcode,SUM(si.quantity) AS qty_sold,
             SUM(si.total_price) AS revenue,
             SUM(si.total_price-(p.cost_price*si.quantity)) AS profit
      FROM sale_items si JOIN products p ON si.product_id=p.id JOIN sales s ON si.sale_id=s.id
      WHERE date(s.sale_date) BETWEEN ? AND ? AND s.status='completed'
      GROUP BY p.id ORDER BY revenue DESC LIMIT 20
    `).all(dateFrom, dateTo);

    const expenses = db.prepare(`
      SELECT category,SUM(amount) AS total FROM expenses
      WHERE date(expense_date) BETWEEN ? AND ? GROUP BY category
    `).all(dateFrom, dateTo);

    const hourlyPattern = db.prepare(`
      SELECT strftime('%H',sale_date) AS hour,AVG(total_amount) AS avg_sale,COUNT(*) AS count
      FROM sales WHERE date(sale_date) BETWEEN ? AND ? AND status='completed'
      GROUP BY hour ORDER BY hour
    `).all(dateFrom, dateTo);

    const categoryRevenue = db.prepare(`
      SELECT cat.name,cat.color,SUM(si.total_price) AS revenue
      FROM sale_items si JOIN products p ON si.product_id=p.id
      JOIN categories cat ON p.category_id=cat.id JOIN sales s ON si.sale_id=s.id
      WHERE date(s.sale_date) BETWEEN ? AND ? AND s.status='completed'
      GROUP BY cat.id ORDER BY revenue DESC
    `).all(dateFrom, dateTo);

    return { paymentBreakdown, dailyTrend, topProducts, expenses, hourlyPattern, categoryRevenue };
  },

  exportToExcel(type, reportsPath) {
    const db = getDb();
    let data;
    if (type === 'sales') {
      data = db.prepare(`
        SELECT s.invoice_number,datetime(s.sale_date) AS date,c.name AS customer,
          u.full_name AS cashier,s.subtotal,s.discount_amount,s.tax_amount,
          s.total_amount,s.payment_method,s.status
        FROM sales s LEFT JOIN customers c ON s.customer_id=c.id
        LEFT JOIN users u ON s.cashier_id=u.id ORDER BY s.created_at DESC
      `).all();
    } else if (type === 'inventory') {
      data = db.prepare(`
        SELECT p.barcode,p.name,c.name AS category,p.stock_quantity,
          p.min_stock_level,p.cost_price,p.selling_price,p.unit
        FROM products p LEFT JOIN categories c ON p.category_id=c.id
        WHERE p.is_active=1 ORDER BY p.name
      `).all();
    } else if (type === 'customers') {
      data = db.prepare(`
        SELECT name,email,phone,city,loyalty_points,total_purchases,customer_type,created_at
        FROM customers WHERE is_active=1 ORDER BY name
      `).all();
    } else if (type === 'sales_summary') {
      data = db.prepare(`
        SELECT date(sale_date) AS date,COUNT(*) AS transaction_count,
               SUM(total_amount) AS total_revenue,SUM(discount_amount) AS total_discount
        FROM sales WHERE status='completed' GROUP BY date ORDER BY date DESC
      `).all();
    } else {
      data = [{ message: 'Unknown export type: ' + type }];
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, type);
    const filename = `bigmart_${type}_${dayjs().format('YYYY-MM-DD_HHmm')}.xlsx`;
    const filepath = path.join(reportsPath, filename);
    XLSX.writeFile(wb, filepath);
    return { success: true, filepath };
  },
};

module.exports.ReportService = ReportService;
