/**
 * electron/src/services/sale.service.js
 * ────────────────────────────────────────
 * Handles the full POS checkout flow (transaction):
 *   create sale → deduct stock → award loyalty → update shift
 */
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDb } = require('../database/database');
const SettingService = require('./setting.service');

const SaleService = {
    generateInvoiceNumber() {
        // ⚠️ This should ONLY be called within a transaction
        // Uses atomic sequence table for thread-safe generation
        const today = dayjs().format('YYYY-MM-DD');
        const dateYYYYMMDD = today.replace(/-/g, '');
        const db = getDb();

        // ✅ Get next sequence from atomic counter table
        // This is called INSIDE a transaction, so it's safe
        const seqCheck = db.prepare(`
            SELECT next_seq FROM invoice_sequences WHERE date_key = ?
        `).get(today);

        let nextSeq;
        if (seqCheck) {
            nextSeq = seqCheck.next_seq;
            db.prepare(`
                UPDATE invoice_sequences 
                SET next_seq = next_seq + 1 
                WHERE date_key = ?
            `).run(today);
        } else {
            nextSeq = 1;
            db.prepare(`
                INSERT INTO invoice_sequences (date_key, next_seq)
                VALUES (?, 2)
            `).run(today);
        }

        return `INV-${dateYYYYMMDD}-${String(nextSeq).padStart(4, '0')}`;
    },

    create(data) {
        const db = getDb();
        const saleId = uuidv4();
        let invoiceNumber;

        // ✅ Use proper better-sqlite3 transaction with IMMEDIATE lock
        try {
            const createTransaction = db.transaction(() => {
                // Generate invoice number INSIDE transaction with lock
                invoiceNumber = SaleService.generateInvoiceNumber();

                // 1. Insert sale header
                db.prepare(`
            INSERT INTO sales
              (id,invoice_number,customer_id,cashier_id,shift_id,subtotal,discount_amount,
               discount_type,tax_amount,total_amount,paid_amount,change_amount,payment_method,
               payment_reference,status,notes,loyalty_points_earned,loyalty_points_used)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
                    saleId, invoiceNumber, data.customer_id || null, data.cashier_id, data.shift_id || null,
                    data.subtotal, data.discount_amount || 0, data.discount_type || 'fixed',
                    data.tax_amount || 0, data.total_amount, data.paid_amount, data.change_amount || 0,
                    data.payment_method || 'cash', data.payment_reference || null,
                    'completed', data.notes || null,
                    data.loyalty_points_earned || 0, data.loyalty_points_used || 0
                );

                // 2. Insert sale items + deduct stock
                const itemStmt = db.prepare(`
            INSERT INTO sale_items
              (id,sale_id,product_id,product_name,barcode,quantity,unit_price,discount_amount,tax_amount,total_price)
            VALUES (?,?,?,?,?,?,?,?,?,?)
          `);
                data.items.forEach(item => {
                    itemStmt.run(
                        uuidv4(), saleId, item.product_id, item.product_name, item.barcode || null,
                        item.quantity, item.unit_price, item.discount_amount || 0, item.tax_amount || 0, item.total_price
                    );
                    db.prepare('UPDATE products SET stock_quantity=stock_quantity-? WHERE id=?')
                        .run(item.quantity, item.product_id);
                });

                // 3. Loyalty points
                if (data.customer_id) {
                    if ((data.loyalty_points_earned || 0) > 0) {
                        db.prepare('UPDATE customers SET loyalty_points=loyalty_points+?, total_purchases=total_purchases+? WHERE id=?')
                            .run(data.loyalty_points_earned, data.total_amount, data.customer_id);
                        db.prepare('INSERT INTO loyalty_transactions (id,customer_id,sale_id,points,transaction_type,description) VALUES (?,?,?,?,?,?)')
                            .run(uuidv4(), data.customer_id, saleId, data.loyalty_points_earned, 'earned', `Sale ${invoiceNumber}`);
                    }
                    if ((data.loyalty_points_used || 0) > 0) {
                        db.prepare('UPDATE customers SET loyalty_points=MAX(0,loyalty_points-?) WHERE id=?')
                            .run(data.loyalty_points_used, data.customer_id);
                        db.prepare('INSERT INTO loyalty_transactions (id,customer_id,sale_id,points,transaction_type,description) VALUES (?,?,?,?,?,?)')
                            .run(uuidv4(), data.customer_id, saleId, -data.loyalty_points_used, 'redeemed', `Sale ${invoiceNumber}`);
                    }
                }

                // 4. Update shift totals
                if (data.shift_id) {
                    db.prepare('UPDATE shifts SET total_sales=total_sales+?, total_transactions=total_transactions+1 WHERE id=?')
                        .run(data.total_amount, data.shift_id);
                }
            });

            // Execute with immediate lock to prevent race conditions
            createTransaction.immediate();
            return { success: true, saleId, invoiceNumber };
        } catch (err) {
            console.error('[Sale Create Error]', err.message);
            throw err;
        }
    },
    getAll(filters = {}) {
        const db = getDb();
        let sql = `SELECT s.*,c.name AS customer_name,u.full_name AS cashier_name
      FROM sales s LEFT JOIN customers c ON s.customer_id=c.id LEFT JOIN users u ON s.cashier_id=u.id WHERE 1=1`;
        const params = [];
        if (filters.date_from) { sql += ' AND date(s.sale_date)>=?'; params.push(filters.date_from); }
        if (filters.date_to) { sql += ' AND date(s.sale_date)<=?'; params.push(filters.date_to); }
        if (filters.cashier_id) { sql += ' AND s.cashier_id=?'; params.push(filters.cashier_id); }
        if (filters.payment_method) { sql += ' AND s.payment_method=?'; params.push(filters.payment_method); }
        if (filters.status) { sql += ' AND s.status=?'; params.push(filters.status); }
        if (filters.search) { sql += ' AND (s.invoice_number LIKE ? OR c.name LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }
        sql += ' ORDER BY s.created_at DESC';
        if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
        return db.prepare(sql).all(...params);
    },

    processReturn(saleId, reason, items) {
        const db = getDb();
        db.transaction(() => {
            db.prepare("UPDATE sales SET is_returned=1,return_reason=?,status='returned' WHERE id=?").run(reason, saleId);
            items.forEach(item => {
                db.prepare('UPDATE products SET stock_quantity=stock_quantity+? WHERE id=?').run(item.quantity, item.product_id);
            });
        })();
        return { success: true };
    },
};

module.exports = SaleService;
