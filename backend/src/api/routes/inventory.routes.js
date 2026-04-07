/**
 * electron/src/api/routes/inventory.routes.js
 * ────────────────────────────────────────────
 * Inventory management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');
const AuditService = require('../../services/audit.service');

module.exports = {
    adjust: (req, res) => {
        try {
            const { product_id, product_name, adjustment_type, adjustment_quantity, reason, adjusted_by } = req.body;

            if (!product_id || !adjustment_quantity) {
                return res.status(400).json({ success: false, message: 'Product and quantity required' });
            }

            const db = getDb();
            const product = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product_id);

            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            const quantityBefore = product.stock_quantity;
            let quantityAfter = quantityBefore;

            switch (adjustment_type) {
                case 'add':
                    quantityAfter = quantityBefore + adjustment_quantity;
                    break;
                case 'remove':
                    quantityAfter = Math.max(0, quantityBefore - adjustment_quantity);
                    break;
                case 'set':
                    quantityAfter = adjustment_quantity;
                    break;
                case 'damage':
                    quantityAfter = Math.max(0, quantityBefore - adjustment_quantity);
                    break;
            }

            const adjustmentId = uuidv4();
            const userId = adjusted_by || (req.user && req.user.sub) || null;

            db.prepare(`
        INSERT INTO stock_adjustments 
        (id, product_id, product_name, adjustment_type, quantity_before, adjustment_quantity, quantity_after, reason, adjusted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adjustmentId, product_id, product_name, adjustment_type, quantityBefore, adjustment_quantity, quantityAfter, reason || null, adjusted_by || null);

            db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(quantityAfter, product_id);

            AuditService.log({
                userId,
                action: 'inventory.adjust',
                tableName: 'products',
                recordId: product_id,
                oldValues: { stock_quantity: quantityBefore },
                newValues: { stock_quantity: quantityAfter, adjustment_type, adjustment_quantity, reason: reason || null }
            });

            res.json({ success: true, id: adjustmentId, message: 'Stock adjusted' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getAdjustments: (req, res) => {
        try {
            const adjustments = getDb().prepare(`
        SELECT * FROM stock_adjustments 
        ORDER BY created_at DESC 
        LIMIT 500
      `).all();
            res.json(adjustments);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
