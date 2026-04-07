/**
 * electron/src/api/routes/expense.routes.js
 * ──────────────────────────────────────────
 * Expense management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');
const AuditService = require('../../services/audit.service');

module.exports = {
    getAll: (req, res) => {
        try {
            const expenses = getDb().prepare(`
        SELECT e.*, u.full_name as recorded_by_name
        FROM expenses e
        LEFT JOIN users u ON e.recorded_by = u.id
        ORDER BY e.expense_date DESC 
        LIMIT 500
      `).all();
            res.json(expenses);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: (req, res) => {
        try {
            const { category, amount, description, payment_method, reference, recorded_by } = req.body;

            if (!category || !amount) {
                return res.status(400).json({ success: false, message: 'Category and amount required' });
            }

            const id = uuidv4();
            const userId = recorded_by || (req.user && req.user.sub) || null;
            getDb().prepare(`
        INSERT INTO expenses (id, category, amount, description, payment_method, reference, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, category, amount, description || null, payment_method || 'cash', reference || null, userId);

            AuditService.log({
                userId,
                action: 'expense.create',
                tableName: 'expenses',
                recordId: id,
                oldValues: null,
                newValues: { category, amount, payment_method: payment_method || 'cash' }
            });

            res.json({ success: true, id, message: 'Expense recorded' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
