/**
 * electron/src/services/product.service.js
 * ──────────────────────────────────────────
 * Business logic for products and categories.
 *
 * HOW TO ADD A FEATURE:
 *   1. Add method here
 *   2. Call it from ProductController
 *   3. Expose it via ipc/product.ipc.js
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { app } = require('electron');
const { getDb } = require('../database/database');

// Inline model class for portability
const BaseModel = require('../models/base.model');
class PM extends BaseModel {
  constructor() { super('products'); }
  findWithRelations(f = {}) {
    let sql = `SELECT p.*,c.name AS category_name,c.color AS category_color,c.icon AS category_icon,s.name AS supplier_name FROM products p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE 1=1`;
    const params = [];
    if (f.search) { sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)'; const q = `%${f.search}%`; params.push(q, q); }
    if (f.category_id) { sql += ' AND p.category_id=?'; params.push(f.category_id); }
    if (f.is_active !== undefined) { sql += ' AND p.is_active=?'; params.push(f.is_active); }
    if (f.low_stock) sql += ' AND p.stock_quantity<=p.min_stock_level';
    sql += ' ORDER BY p.name ASC';
    if (f.limit) { sql += ' LIMIT ?'; params.push(f.limit); }
    return this.query(sql, params);
  }
  findByBarcode(b) { return this.queryOne(`SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.barcode=? AND p.is_active=1`, [b]); }
}
const productModel = new PM();

const imagesPath = path.join(app.getPath('userData'), 'product-images');
if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true });

const ProductService = {
  getAll(filters) { return productModel.findWithRelations(filters); },
  getById(id) { return productModel.findById(id); },
  getByBarcode(barcode) { return productModel.findByBarcode(barcode); },

  create(data) {
    const id = uuidv4();
    if (!data.barcode) data.barcode = `BM${Date.now()}`;
    productModel.insert({
      id, barcode: data.barcode, name: data.name,
      description: data.description || null,
      category_id: data.category_id || null, supplier_id: data.supplier_id || null,
      unit: data.unit || 'pcs', cost_price: data.cost_price || 0,
      selling_price: data.selling_price, discount_price: data.discount_price || null,
      tax_rate: data.tax_rate || 0, stock_quantity: data.stock_quantity || 0,
      min_stock_level: data.min_stock_level || 10, max_stock_level: data.max_stock_level || 1000,
      reorder_point: data.reorder_point || 20, is_active: data.is_active !== false ? 1 : 0,
      is_featured: data.is_featured ? 1 : 0, expiry_date: data.expiry_date || null,
      location: data.location || null, weight: data.weight || null,
    });
    return { success: true, id };
  },

  update(id, data) {
    productModel.updateById(id, {
      barcode: data.barcode,
      name: data.name, description: data.description,
      category_id: data.category_id, supplier_id: data.supplier_id,
      unit: data.unit, cost_price: data.cost_price, selling_price: data.selling_price,
      discount_price: data.discount_price, tax_rate: data.tax_rate,
      stock_quantity: data.stock_quantity,
      min_stock_level: data.min_stock_level, max_stock_level: data.max_stock_level,
      reorder_point: data.reorder_point, is_active: data.is_active ? 1 : 0,
      is_featured: data.is_featured ? 1 : 0, expiry_date: data.expiry_date,
      location: data.location, weight: data.weight,
    });
    return { success: true };
  },

  softDelete(id) { productModel.softDelete(id); return { success: true }; },

  saveImage(productId, imageData, extension) {
    const filename = `${productId}.${extension}`;
    const filepath = path.join(imagesPath, filename);
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
    productModel.run('UPDATE products SET image_path=? WHERE id=?', [filepath, productId]);
    return { success: true, path: filepath };
  },

  getImage(imagePath) {
    if (!imagePath || !fs.existsSync(imagePath)) return null;
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).slice(1);
    return `data:image/${ext};base64,${data.toString('base64')}`;
  },

  getLowStock() {
    return productModel.query(`
      SELECT p.*, c.name AS category_name FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      WHERE p.stock_quantity<=p.min_stock_level AND p.is_active=1
      ORDER BY (p.stock_quantity-p.min_stock_level) ASC
    `);
  },

  bulkImport(filePath) {
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const db = getDb();
    let imported = 0, failed = 0;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO products (id,barcode,name,category_id,cost_price,selling_price,stock_quantity,unit)
      VALUES (?,?,?,(SELECT id FROM categories WHERE name=?),?,?,?,?)
    `);
    db.transaction((rows) => {
      rows.forEach(r => {
        try {
          stmt.run(uuidv4(), r.barcode || `BM${Date.now()}`, r.name, r.category || '',
            r.cost_price || 0, r.selling_price || 0, r.stock_quantity || 0, r.unit || 'pcs');
          imported++;
        } catch { failed++; }
      });
    })(rows);
    return { success: true, imported, failed, total: rows.length };
  },
};

module.exports = ProductService;
