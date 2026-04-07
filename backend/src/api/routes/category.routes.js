/**
 * electron/src/api/routes/category.routes.js
 * ────────────────────────────────────────────
 * Category management endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    getAll: (req, res) => {
        try {
            const categories = getDb().prepare(`
        SELECT c.*, COUNT(p.id) AS product_count
        FROM categories c 
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        WHERE c.is_active = 1 
        GROUP BY c.id 
        ORDER BY c.name
      `).all();
            res.json(categories);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: (req, res) => {
        try {
            const { name, description, color, icon } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, message: 'Category name required' });
            }
            const id = uuidv4();
            getDb().prepare(`
        INSERT INTO categories (id, name, description, color, icon, is_active) 
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(id, name, description || null, color || '#4f9cf9', icon || 'category');

            res.json({ success: true, id, message: 'Category created' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: (req, res) => {
        try {
            const { name, description, color, icon } = req.body;
            const id = req.params.id;

            getDb().prepare(`
        UPDATE categories 
        SET name = ?, description = ?, color = ?, icon = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, description || null, color, icon, id);

            res.json({ success: true, message: 'Category updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
