/**
 * electron/src/api/routes/customer.routes.js
 * ───────────────────────────────────────────
 * Customer management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    getAll: (req, res) => {
        try {
            const customers = getDb().prepare(`
        SELECT * FROM customers 
        WHERE is_active = 1 
        ORDER BY name
      `).all();
            res.json(customers);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getById: (req, res) => {
        try {
            const customer = getDb().prepare(`
        SELECT * FROM customers WHERE id = ? AND is_active = 1
      `).get(req.params.id);
            if (!customer) {
                return res.status(404).json({ success: false, message: 'Customer not found' });
            }
            res.json(customer);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getByPhone: (req, res) => {
        try {
            const customer = getDb().prepare(`
        SELECT * FROM customers WHERE phone = ? AND is_active = 1 LIMIT 1
      `).get(req.params.phone);
            res.json(customer || null);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: (req, res) => {
        try {
            const { name, email, phone, address, city, loyalty_points, customer_type, date_of_birth, notes } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, message: 'Customer name required' });
            }

            const id = uuidv4();
            getDb().prepare(`
        INSERT INTO customers 
        (id, name, email, phone, address, city, loyalty_points, customer_type, date_of_birth, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, name, email || null, phone || null, address || null, city || null, loyalty_points || 0, customer_type || 'regular', date_of_birth || null, notes || null);

            res.json({ success: true, id, message: 'Customer created' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: (req, res) => {
        try {
            const { id, name, email, phone, address, city, loyalty_points, customer_type, date_of_birth, notes } = req.body;

            getDb().prepare(`
        UPDATE customers 
        SET name = ?, email = ?, phone = ?, address = ?, city = ?, loyalty_points = ?, customer_type = ?, date_of_birth = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, email || null, phone || null, address || null, city || null, loyalty_points || 0, customer_type || 'regular', date_of_birth || null, notes || null, id);

            res.json({ success: true, message: 'Customer updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getPurchaseHistory: (req, res) => {
        try {
            const history = getDb().prepare(`
        SELECT * FROM sales 
        WHERE customer_id = ? AND status = 'completed'
        ORDER BY sale_date DESC 
        LIMIT 50
      `).all(req.params.id);
            res.json(history);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
