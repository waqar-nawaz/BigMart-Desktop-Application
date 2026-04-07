/**
 * backend/src/api/routes/user.routes.js
 * ──────────────────────────────────────
 * User (Employee) management endpoints
 *
 * IMPORTANT: Uses bcrypt for password hashing to stay consistent
 * with auth.service.js login verification (bcrypt.compareSync).
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

module.exports = {
    getAll: (req, res) => {
        try {
            const users = getDb().prepare(`
        SELECT id, username, full_name, email, role, is_active, last_login, created_at
        FROM users 
        WHERE is_active = 1
        ORDER BY full_name
      `).all();
            res.json(users);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: (req, res) => {
        try {
            const { username, password, full_name, email, role, pin } = req.body;

            if (!username || !password || !full_name) {
                return res.status(400).json({ success: false, message: 'Username, password, and full name required' });
            }

            // Check if username exists
            const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username);
            if (existing) {
                return res.status(409).json({ success: false, message: 'Username already exists' });
            }

            const id = uuidv4();
            const passwordHash = hashPassword(password);

            getDb().prepare(`
        INSERT INTO users (id, username, password_hash, full_name, email, role, pin, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, username, passwordHash, full_name, email || null, role || 'cashier', pin || null);

            res.json({
                success: true,
                id,
                message: 'User created successfully'
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: (req, res) => {
        try {
            const { id, username, password, full_name, email, role, pin, is_active } = req.body;

            if (!full_name) {
                return res.status(400).json({ success: false, message: 'Full name required' });
            }

            const activeFlag = (is_active === false || is_active === 0) ? 0 : 1;

            let query = `
        UPDATE users 
        SET full_name = ?, email = ?, role = ?, pin = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

            const params = [full_name, email || null, role || 'cashier', pin || null, activeFlag, id];

            // If password is provided, update it
            if (password) {
                query = `
          UPDATE users 
          SET full_name = ?, email = ?, role = ?, pin = ?, is_active = ?, password_hash = ?, updated_at = datetime('now')
          WHERE id = ?
        `;
                params.splice(5, 0, hashPassword(password));
            }

            getDb().prepare(query).run(...params);

            res.json({ success: true, message: 'User updated successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
