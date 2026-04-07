/**
 * electron/src/models/product.model.js
 * ──────────────────────────────────────
 * Database queries for the `products` table.
 *
 * HOW TO ADD A QUERY:
 *   Add a method here → call it from ProductService → expose via IPC.
 */
const BaseModel = require('./base.model');

class ProductModel extends BaseModel {
  constructor() { super('products'); }

  /** Full product with category & supplier names */
  findWithRelations(filters = {}) {
    let sql = `
      SELECT p.*,
             c.name  AS category_name,
             c.color AS category_color,
             c.icon  AS category_icon,
             s.name  AS supplier_name
      FROM   products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers  s ON p.supplier_id  = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }
    if (filters.category_id) { sql += ' AND p.category_id = ?'; params.push(filters.category_id); }
    if (filters.supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(filters.supplier_id); }
    if (filters.is_active !== undefined) { sql += ' AND p.is_active = ?'; params.push(filters.is_active); }
    if (filters.low_stock)  sql += ' AND p.stock_quantity <= p.min_stock_level';
    if (filters.is_featured) sql += ' AND p.is_featured = 1';

    sql += ' ORDER BY p.name ASC';
    if (filters.limit)  { sql += ' LIMIT ?';  params.push(filters.limit); }
    if (filters.offset) { sql += ' OFFSET ?'; params.push(filters.offset); }

    return this.query(sql, params);
  }

  findByBarcode(barcode) {
    return this.queryOne(`
      SELECT p.*, c.name AS category_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ? AND p.is_active = 1
    `, [barcode]);
  }

  decrementStock(productId, qty) {
    return this.run(
      'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
      [qty, productId]
    );
  }

  incrementStock(productId, qty) {
    return this.run(
      'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
      [qty, productId]
    );
  }

  setStock(productId, qty) {
    return this.run(
      'UPDATE products SET stock_quantity = ? WHERE id = ?',
      [qty, productId]
    );
  }

  getLowStock() {
    return this.query(`
      SELECT p.*, c.name AS category_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock_quantity <= p.min_stock_level AND p.is_active = 1
      ORDER BY (p.stock_quantity - p.min_stock_level) ASC
    `);
  }
}

module.exports = new ProductModel();
