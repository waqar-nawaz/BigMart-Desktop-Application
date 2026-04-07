/**
 * electron/src/api/routes/sales.routes.js
 * ────────────────────────────────────────
 * Sales (POS) transaction endpoints
 */

const { getDb } = require('../../database/database');
const SaleService = require('../../services/sale.service');

module.exports = {
    create: (req, res) => {
        try {
            const cashierId = req.body.cashier_id || (req.user && req.user.sub);
            const payload = { ...req.body, cashier_id: cashierId };
            const result = SaleService.create(payload);
            res.json({ ...result, message: 'Sale completed successfully' });
        } catch (err) {
            console.error('[Sales Create Error]', err.message);
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getAll: (req, res) => {
        try {
            const { date_from, date_to, customer_id, payment_method, status } = req.query;

            let query = `
        SELECT s.*, 
               c.name as customer_name, u.full_name as cashier_name,
               COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1
      `;

            const params = [];

            if (date_from) {
                query += ` AND DATE(s.sale_date) >= ?`;
                params.push(date_from);
            }
            if (date_to) {
                query += ` AND DATE(s.sale_date) <= ?`;
                params.push(date_to);
            }
            if (customer_id) {
                query += ` AND s.customer_id = ?`;
                params.push(customer_id);
            }
            if (payment_method) {
                query += ` AND s.payment_method = ?`;
                params.push(payment_method);
            }
            if (status) {
                query += ` AND s.status = ?`;
                params.push(status);
            }

            query += ` GROUP BY s.id ORDER BY s.sale_date DESC LIMIT 500`;

            const sales = getDb().prepare(query).all(...params);

            // Load items for each sale
            sales.forEach(sale => {
                sale.items = getDb().prepare(`
          SELECT * FROM sale_items WHERE sale_id = ?
        `).all(sale.id);
            });

            res.json(sales);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getById: (req, res) => {
        try {
            const sale = getDb().prepare(`
        SELECT s.*, 
               c.name as customer_name, u.full_name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `).get(req.params.id);

            if (!sale) {
                return res.status(404).json({ success: false, message: 'Sale not found' });
            }

            sale.items = getDb().prepare(`
        SELECT * FROM sale_items WHERE sale_id = ?
      `).all(sale.id);

            res.json(sale);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    return: (req, res) => {
        try {
            const { saleId, returnReason } = req.body;
            const userId = (req.user && req.user.sub) || null;
            const result = SaleService.processReturn({ saleId, reason: returnReason, userId });
            res.json({ ...result, message: 'Sale returned successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    generateReceipt: (req, res) => {
        try {
            const sale = getDb().prepare(`
        SELECT s.*, 
               c.name as customer_name, u.full_name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `).get(req.params.id);

            if (!sale) {
                return res.status(404).json({ success: false, message: 'Sale not found' });
            }

            sale.items = getDb().prepare(`
        SELECT * FROM sale_items WHERE sale_id = ?
      `).all(sale.id);

            const settings = getDb().prepare('SELECT * FROM settings').all();
            const settingsObj = {};
            settings.forEach(s => { settingsObj[s.key] = s.value; });

            res.json({ success: true, sale, settings: settingsObj });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
