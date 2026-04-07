/**
 * electron/src/api/routes/supplier.routes.js
 * ───────────────────────────────────────────
 * Supplier management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    getAll: (req, res) => {
        try {
            const suppliers = getDb().prepare(`
        SELECT * FROM suppliers 
        WHERE is_active = 1 
        ORDER BY name
      `).all();
            res.json(suppliers);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: (req, res) => {
        try {
            const { name, contact_person, email, phone, address, city, tax_number, payment_terms, notes } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, message: 'Supplier name required' });
            }

            const id = uuidv4();
            getDb().prepare(`
        INSERT INTO suppliers 
        (id, name, contact_person, email, phone, address, city, tax_number, payment_terms, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, name, contact_person || null, email || null, phone || null, address || null, city || null, tax_number || null, payment_terms || 30, notes || null);

            res.json({ success: true, id, message: 'Supplier created' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: (req, res) => {
        try {
            const { name, contact_person, email, phone, address, city, tax_number, payment_terms, notes } = req.body;
            const id = req.params.id;

            getDb().prepare(`
        UPDATE suppliers 
        SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, city = ?, tax_number = ?, payment_terms = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, contact_person || null, email || null, phone || null, address || null, city || null, tax_number || null, payment_terms || 30, notes || null, id);

            res.json({ success: true, message: 'Supplier updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
