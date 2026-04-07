#!/usr/bin/env node
/**
 * electron/src/api/start-api.js
 * ──────────────────────────────
 * Standalone API server that can run independently from  Electron.
 * Started by npm during development.
 */

const express = require('express');
const cors = require('cors');
const { initDatabase, getDb } = require('../database/database');

// Initialize database (creates schema and seeds data)
initDatabase();
const db = getDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Import route handlers
const dashboardRoutes = require('./routes/dashboard.routes');
const expenseRoutes = require('./routes/expense.routes');
const salesRoutes = require('./routes/sales.routes');
const customerRoutes = require('./routes/customer.routes');

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
        if (user) {
            res.json({ success: true, user });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/auth/pinLogin', (req, res) => {
    const { pin } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE pin = ?').get(pin);
    if (user) {
        res.json({ success: true, user });
    } else {
        res.json({ success: false, message: 'Invalid PIN' });
    }
});

// Product endpoints
app.get('/api/products', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
        res.json(products || []);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/products/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        res.json(product || {});
    } catch (err) {
        res.json({});
    }
});

app.get('/api/products/barcode/:barcode', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(req.params.barcode);
        res.json(product || null);
    } catch (err) {
        res.json(null);
    }
});

// Category endpoints
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories').all();
        res.json(categories || []);
    } catch (err) {
        res.json([]);
    }
});

// Customer endpoints
app.get('/api/customers', (req, res) => {
    try {
        const customers = db.prepare('SELECT * FROM customers').all();
        res.json(customers || []);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/customers/phone/:phone', (req, res) => {
    try {
        const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(req.params.phone);
        res.json(customer || null);
    } catch (err) {
        res.json(null);
    }
});

// Sales endpoints
app.get('/api/sales', (req, res) => {
    try {
        const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
        res.json(sales || []);
    } catch (err) {
        res.json([]);
    }
});

// User endpoints
app.get('/api/users', (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, full_name, email, role, pin, is_active, last_login, created_at FROM users ORDER BY full_name').all();
        res.json(users || []);
    } catch (err) {
        console.error('[API] Error getting users:', err);
        res.json([]);
    }
});

app.post('/api/users', (req, res) => {
    try {
        const { v4: uuidv4 } = require('uuid');
        const bcrypt = require('bcryptjs');
        const { username, password, full_name, email, role, pin, is_active } = req.body;

        const id = uuidv4();
        const hash = bcrypt.hashSync(password, 10);

        db.prepare(`
            INSERT INTO users (id, username, password_hash, full_name, email, role, pin, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, username, hash, full_name, email || null, role || 'cashier', pin || null, is_active !== false ? 1 : 0);

        res.json({ success: true, id });
    } catch (err) {
        console.error('[API] Error creating user:', err);
        res.json({ success: false, message: err.message });
    }
});

app.put('/api/users/:id', (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { id } = req.params;
        const { username, password, full_name, email, role, pin, is_active } = req.body;

        let updateFields = ['username = ?', 'full_name = ?', 'email = ?', 'role = ?', 'pin = ?', 'is_active = ?', 'updated_at = datetime(\'now\')'];
        let values = [username, full_name, email || null, role, pin || null, is_active ? 1 : 0];

        if (password) {
            updateFields.unshift('password_hash = ?');
            values.unshift(bcrypt.hashSync(password, 10));
        }

        values.push(id);
        const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

        db.prepare(sql).run(...values);
        res.json({ success: true });
    } catch (err) {
        console.error('[API] Error updating user:', err);
        res.json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Routes
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/dashboard/stats', dashboardRoutes.getStats);

// ═══════════════════════════════════════════════════════════════════════════
// Expenses Routes
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/expenses', expenseRoutes.getAll);
app.post('/api/expenses', expenseRoutes.create);

// Generic catch-all for other endpoints (return empty/success)
app.get('/api/*', (req, res) => {
    res.json([]);
});

app.post('/api/*', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

app.put('/api/*', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

app.delete('/api/*', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

const PORT = process.env.API_PORT || 3000;

function startServer() {
    return new Promise((resolve, reject) => {
        if (!global.apiStarted) {
            app.listen(PORT, () => {
                console.log(`[API] ✓ Server running on http://localhost:${PORT}`);
                global.apiStarted = true;
                resolve(PORT);
            }).on('error', reject);
        } else {
            resolve(PORT);
        }
    });
}

// ✅ Only auto-start if run directly (NOT when required by Electron)
if (require.main === module) {
    startServer();
}

module.exports = { startServer };
