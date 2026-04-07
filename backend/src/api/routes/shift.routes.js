/**
 * electron/src/api/routes/shift.routes.js
 * ────────────────────────────────────────
 * Shift management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    open: (req, res) => {
        try {
            const { cashier_id, opening_cash } = req.body;

            if (!cashier_id) {
                return res.status(400).json({ success: false, message: 'Cashier ID required' });
            }

            const shiftId = uuidv4();
            getDb().prepare(`
        INSERT INTO shifts (id, cashier_id, start_time, opening_cash, status)
        VALUES (?, ?, datetime('now'), ?, 'open')
      `).run(shiftId, cashier_id, opening_cash || 0);

            res.json({ success: true, shiftId, message: 'Shift opened' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    close: (req, res) => {
        try {
            const { shift_id, closing_cash } = req.body;

            getDb().prepare(`
        UPDATE shifts 
        SET end_time = datetime('now'), closing_cash = ?, status = 'closed'
        WHERE id = ?
      `).run(closing_cash || 0, shift_id);

            res.json({ success: true, message: 'Shift closed' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getActive: (req, res) => {
        try {
            const shift = getDb().prepare(`
        SELECT * FROM shifts 
        WHERE cashier_id = ? AND status = 'open'
        ORDER BY start_time DESC 
        LIMIT 1
      `).get(req.params.cashierId);

            res.json(shift || null);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getAll: (req, res) => {
        try {
            const shifts = getDb().prepare(`
        SELECT s.*, u.full_name as cashier_name 
        FROM shifts s
        LEFT JOIN users u ON s.cashier_id = u.id
        ORDER BY s.start_time DESC 
        LIMIT 500
      `).all();
            res.json(shifts);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
