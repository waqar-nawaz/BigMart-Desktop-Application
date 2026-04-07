/**
 * electron/src/api/routes/purchase.routes.js
 * ──────────────────────────────────────────
 * Purchase order endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

module.exports = {
    create: (req, res) => {
        try {
            const { supplier_id, items, created_by, notes } = req.body;

            if (!supplier_id || !items || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Supplier and items required' });
            }

            const db = getDb();
            const poId = uuidv4();
            const today = dayjs().format('YYYY-MM-DD');

            // Generate PO number
            const lastPO = db.prepare(`
        SELECT po_number FROM purchases 
        WHERE DATE(order_date) = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(today);

            let poNumber;
            if (lastPO) {
                const lastNum = parseInt(lastPO.po_number.split('-')[2]);
                poNumber = `PO-${today.replace(/-/g, '')}-${String(lastNum + 1).padStart(4, '0')}`;
            } else {
                poNumber = `PO-${today.replace(/-/g, '')}-0001`;
            }

            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0);
            const taxAmount = subtotal * 0.15; // 15% tax
            const totalAmount = subtotal + taxAmount;

            // Insert PO
            db.prepare(`
        INSERT INTO purchases 
        (id, po_number, supplier_id, status, subtotal, tax_amount, total_amount, created_by, notes)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
      `).run(poId, poNumber, supplier_id, subtotal, taxAmount, totalAmount, created_by || null, notes || null);

            // Insert items
            items.forEach(item => {
                const itemId = uuidv4();
                db.prepare(`
          INSERT INTO purchase_items 
          (id, purchase_id, product_id, product_name, quantity_ordered, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, poId, item.product_id, item.product_name, item.quantity, item.unit_cost, item.quantity * item.unit_cost);
            });

            res.json({ success: true, poId, poNumber, message: 'Purchase order created' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    receive: (req, res) => {
        try {
            const { poId, items } = req.body;
            const db = getDb();

            db.prepare('UPDATE purchases SET status = ?, received_date = datetime(\'now\') WHERE id = ?')
                .run('received', poId);

            // Update stock and received quantity
            items.forEach(item => {
                db.prepare(`
          UPDATE purchase_items 
          SET quantity_received = ? 
          WHERE purchase_id = ? AND product_id = ?
        `).run(item.quantity_received, poId, item.product_id);

                db.prepare(`
          UPDATE products 
          SET stock_quantity = stock_quantity + ? 
          WHERE id = ?
        `).run(item.quantity_received, item.product_id);
            });

            res.json({ success: true, message: 'Purchase received and stock updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getAll: (req, res) => {
        try {
            const purchases = getDb().prepare(`
        SELECT p.*, s.name as supplier_name 
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.order_date DESC 
        LIMIT 500
      `).all();

            purchases.forEach(p => {
                p.items = getDb().prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);
            });

            res.json(purchases);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getById: (req, res) => {
        try {
            const purchase = getDb().prepare(`
        SELECT p.*, s.name as supplier_name 
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
      `).get(req.params.id);

            if (!purchase) {
                return res.status(404).json({ success: false, message: 'Purchase not found' });
            }

            purchase.items = getDb().prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);

            res.json(purchase);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
