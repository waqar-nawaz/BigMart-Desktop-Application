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
const AuditService = require('./audit.service');

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
                if (!data || !Array.isArray(data.items) || data.items.length === 0) {
                    throw new Error('Sale items required');
                }
                if (!data.cashier_id) {
                    throw new Error('cashier_id required');
                }

                // Validate items and stock before writing anything
                const productById = db.prepare('SELECT id,name,stock_quantity,selling_price,is_active FROM products WHERE id=?').get;
                let computedSubtotal = 0;
                let computedTax = 0;
                let computedDiscount = 0;
                let computedTotal = 0;

                data.items.forEach((item) => {
                    if (!item.product_id) throw new Error('item.product_id required');
                    const qty = Number(item.quantity);
                    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Invalid item quantity');

                    const product = productById(item.product_id);
                    if (!product || product.is_active !== 1) throw new Error('Product not found or inactive');

                    if (Number(product.stock_quantity) < qty) {
                        throw new Error(`Insufficient stock for ${product.name}`);
                    }

                    const unitPrice = Number(item.unit_price ?? product.selling_price);
                    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Invalid unit price');

                    const lineSubtotal = unitPrice * qty;
                    const lineDiscount = Number(item.discount_amount || 0);
                    const lineTax = Number(item.tax_amount || 0);
                    const lineTotal = Number(item.total_price ?? (lineSubtotal - lineDiscount + lineTax));

                    computedSubtotal += lineSubtotal;
                    computedDiscount += lineDiscount;
                    computedTax += lineTax;
                    computedTotal += lineTotal;
                });

                const subtotal = Number(data.subtotal ?? computedSubtotal);
                const discountAmount = Number(data.discount_amount ?? computedDiscount);
                const taxAmount = Number(data.tax_amount ?? computedTax);
                const totalAmount = Number(data.total_amount ?? computedTotal);

                if (!Number.isFinite(subtotal) || !Number.isFinite(totalAmount)) throw new Error('Invalid totals');
                if (totalAmount < 0) throw new Error('Invalid total amount');

                const paidAmount = Number(data.paid_amount ?? totalAmount);
                if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new Error('Invalid paid amount');
                if (paidAmount + 1e-6 < totalAmount && (data.payment_method || 'cash') !== 'credit') {
                    throw new Error('Paid amount less than total');
                }

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
                    subtotal, discountAmount, data.discount_type || 'fixed',
                    taxAmount, totalAmount, paidAmount, data.change_amount || 0,
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
                        .run(totalAmount, data.shift_id);
                }

                AuditService.log({
                    userId: data.cashier_id,
                    action: 'sale.create',
                    tableName: 'sales',
                    recordId: saleId,
                    oldValues: null,
                    newValues: { invoiceNumber, totalAmount, payment_method: data.payment_method || 'cash' },
                });
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

    processReturn({ saleId, reason, userId }) {
        const db = getDb();
        db.transaction(() => {
            const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);
            if (!sale) throw new Error('Sale not found');
            if (sale.status === 'returned' || sale.is_returned === 1) throw new Error('Sale already returned');

            db.prepare("UPDATE sales SET is_returned=1,return_reason=?,status='returned' WHERE id=?")
                .run(reason || null, saleId);

            const saleItems = db.prepare('SELECT product_id,quantity FROM sale_items WHERE sale_id=?').all(saleId);
            saleItems.forEach(item => {
                db.prepare('UPDATE products SET stock_quantity=stock_quantity+? WHERE id=?')
                    .run(item.quantity, item.product_id);
            });

            if (sale.shift_id) {
                db.prepare('UPDATE shifts SET total_sales=MAX(0,total_sales-?), total_transactions=MAX(0,total_transactions-1) WHERE id=?')
                    .run(sale.total_amount, sale.shift_id);
            }

            AuditService.log({
                userId,
                action: 'sale.return',
                tableName: 'sales',
                recordId: saleId,
                oldValues: { status: sale.status, is_returned: sale.is_returned },
                newValues: { status: 'returned', return_reason: reason || null },
            });
        })();
        return { success: true };
    },
};

module.exports = SaleService;
