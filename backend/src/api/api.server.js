/**
 * electron/src/api/api.server.js
 * ──────────────────────────────
 * Express REST API server for both Electron and Browser modes.
 * Exposes all backend functionality via HTTP endpoints.
 * Can be used by both:
 *   1. Electron (via ipcMain that calls this)
 *   2. Browser (via HTTP fetch)
 */

const express = require('express');
const cors = require('cors');
const { getDb, initDatabase } = require('../database/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Initialize database before starting
initDatabase();

// ═══════════════════════════════════════════════════════════════════════════
// API Routes - Import and register all routes
// ═══════════════════════════════════════════════════════════════════════════

// Auth Routes
app.post('/api/auth/login', require('./routes/auth.routes').login);
app.post('/api/auth/pinLogin', require('./routes/auth.routes').pinLogin);
app.post('/api/auth/changePassword', require('./routes/auth.routes').changePassword);

// Product Routes
app.get('/api/products', require('./routes/product.routes').getAll);
app.get('/api/products/:id', require('./routes/product.routes').getById);
app.get('/api/products/barcode/:barcode', require('./routes/product.routes').getByBarcode);
app.post('/api/products', require('./routes/product.routes').create);
app.put('/api/products/:id', require('./routes/product.routes').update);
app.delete('/api/products/:id', require('./routes/product.routes').delete);
app.post('/api/products/image/save', require('./routes/product.routes').saveImage);
app.get('/api/products/image/:path', require('./routes/product.routes').getImage);
app.post('/api/products/import', require('./routes/product.routes').bulkImport);
app.get('/api/products/low-stock', require('./routes/product.routes').getLowStock);

// Category Routes
app.get('/api/categories', require('./routes/category.routes').getAll);
app.post('/api/categories', require('./routes/category.routes').create);
app.put('/api/categories/:id', require('./routes/category.routes').update);

// Customer Routes
app.get('/api/customers', require('./routes/customer.routes').getAll);
app.get('/api/customers/:id', require('./routes/customer.routes').getById);
app.get('/api/customers/phone/:phone', require('./routes/customer.routes').getByPhone);
app.post('/api/customers', require('./routes/customer.routes').create);
app.put('/api/customers/:id', require('./routes/customer.routes').update);
app.get('/api/customers/:id/history', require('./routes/customer.routes').getPurchaseHistory);

// Sales Routes
app.post('/api/sales', require('./routes/sales.routes').create);
app.get('/api/sales/:id', require('./routes/sales.routes').getById);
app.get('/api/sales', require('./routes/sales.routes').getAll);
app.post('/api/sales/return', require('./routes/sales.routes').return);
app.post('/api/sales/:id/receipt', require('./routes/sales.routes').generateReceipt);

// Inventory Routes
app.post('/api/inventory/adjust', require('./routes/inventory.routes').adjust);
app.get('/api/inventory/adjustments', require('./routes/inventory.routes').getAdjustments);

// Purchase Routes
app.post('/api/purchases', require('./routes/purchase.routes').create);
app.post('/api/purchases/receive', require('./routes/purchase.routes').receive);
app.get('/api/purchases', require('./routes/purchase.routes').getAll);
app.get('/api/purchases/:id', require('./routes/purchase.routes').getById);

// Supplier Routes
app.get('/api/suppliers', require('./routes/suppliers.routes').getAll);
app.post('/api/suppliers', require('./routes/suppliers.routes').create);
app.put('/api/suppliers/:id', require('./routes/suppliers.routes').update);

// User Routes
app.get('/api/users', require('./routes/user.routes').getAll);
app.post('/api/users', require('./routes/user.routes').create);
app.put('/api/users/:id', require('./routes/user.routes').update);

// Shift Routes
app.post('/api/shifts/open', require('./routes/shift.routes').open);
app.post('/api/shifts/close', require('./routes/shift.routes').close);
app.get('/api/shifts/active/:cashierId', require('./routes/shift.routes').getActive);
app.get('/api/shifts', require('./routes/shift.routes').getAll);

// Expense Routes
app.get('/api/expenses', require('./routes/expense.routes').getAll);
app.post('/api/expenses', require('./routes/expense.routes').create);

// Report Routes
app.post('/api/reports/sales-summary', require('./routes/report.routes').salesSummary);
app.post('/api/reports/export-excel', require('./routes/report.routes').exportExcel);

// Dashboard Routes
app.get('/api/dashboard/stats', require('./routes/dashboard.routes').getStats);

// Settings Routes
app.get('/api/settings', require('./routes/settings.routes').getAll);
app.put('/api/settings', require('./routes/settings.routes').update);

// Backup Routes
app.post('/api/backup/create', require('./routes/backup.routes').create);
app.get('/api/backup/list', require('./routes/backup.routes').listBackups);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ success: false, message: err.message });
});

function startServer(port = 3000) {
    return new Promise((resolve, reject) => {
        app.listen(port, () => {
            console.log(`[API] REST API server running on http://localhost:${port}`);
            resolve(port);
        }).on('error', reject);
    });
}

module.exports = { app, startServer };
