/**
 * electron/src/api/routes/sales.routes.js
 * ────────────────────────────────────────
 * Sales (POS) transaction endpoints
 */

const { getDb } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

module.exports = {
    create: (req, res) => {
        try {
            const { customer_id, cashier_id, items, payment_method, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, notes } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Sale items required' });
            }

            const db = getDb();
            const saleId = uuidv4();
            const today = dayjs().format('YYYY-MM-DD');
            const dateYYYYMMDD = today.replace(/-/g, '');

            let invoiceNumber;

            // ✅ Use atomic sequence table with IMMEDIATE transaction
            try {
                const createSaleTransaction = db.transaction(() => {
                    // Step 1: Get or create sequence for today
                    const seqCheck = db.prepare(`
              SELECT next_seq FROM invoice_sequences WHERE date_key = ?
            `).get(today);

                    let nextSeq;
                    if (seqCheck) {
                        // Increment and update
                        nextSeq = seqCheck.next_seq;
                        db.prepare(`
                UPDATE invoice_sequences 
                SET next_seq = next_seq + 1 
                WHERE date_key = ?
              `).run(today);
                    } else {
                        // Create new sequence (first invoice of the day)
                        nextSeq = 1;
                        db.prepare(`
                INSERT INTO invoice_sequences (date_key, next_seq)
                VALUES (?, 2)
              `).run(today);
                    }

                    // Format: INV-YYYYMMDD-0001
                    invoiceNumber = `INV-${dateYYYYMMDD}-${String(nextSeq).padStart(4, '0')}`;

                    // Step 2: Insert sale record
                    db.prepare(`
              INSERT INTO sales 
              (id, invoice_number, customer_id, cashier_id, sale_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, payment_method, status, notes)
              VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
            `).run(
                        saleId, invoiceNumber, customer_id || null, cashier_id || null,
                        subtotal, discount_amount || 0, tax_amount || 0, total_amount, paid_amount, change_amount || 0,
                        payment_method || 'cash', notes || null
                    );

                    // Step 3: Insert sale items and update stock
                    items.forEach(item => {
                        const itemId = uuidv4();

                        // Insert item
                        db.prepare(`
                INSERT INTO sale_items 
                (id, sale_id, product_id, product_name, barcode, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(itemId, saleId, item.product_id, item.product_name, item.barcode, item.quantity, item.unit_price, item.total_price);

                        // Update product stock
                        db.prepare(`
                UPDATE products 
                SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
                WHERE id = ?
              `).run(item.quantity, item.product_id);
                    });
                });

                // Execute transaction with IMMEDIATE lock (serialized)
                createSaleTransaction.immediate();

                res.json({
                    success: true,
                    saleId,
                    invoiceNumber,
                    message: 'Sale completed successfully'
                });
            } catch (txnErr) {
                throw txnErr;
            }
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
            const db = getDb();

            const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
            if (!sale) {
                return res.status(404).json({ success: false, message: 'Sale not found' });
            }

            // Mark as returned and reverse stock
            db.prepare(`
        UPDATE sales 
        SET status = 'returned', is_returned = 1, return_reason = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(returnReason || null, saleId);

            // Reverse stock for each item
            const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
            items.forEach(item => {
                db.prepare(`
          UPDATE products 
          SET stock_quantity = stock_quantity + ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(item.quantity, item.product_id);
            });

            res.json({ success: true, message: 'Sale returned successfully' });
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
