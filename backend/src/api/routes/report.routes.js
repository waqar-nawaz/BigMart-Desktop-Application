/**
 * electron/src/api/routes/report.routes.js
 * ─────────────────────────────────────────
 * Reporting endpoints
 */

const { getDb } = require('../../database/database');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dayjs = require('dayjs');

module.exports = {
    salesSummary: (req, res) => {
        try {
            const { date_from, date_to } = req.body;
            const db = getDb();

            // Daily sales summary
            const dailySales = db.prepare(`
        SELECT 
          DATE(sale_date) as date,
          COUNT(*) as transactions,
          SUM(total_amount) as revenue,
          SUM(discount_amount) as discount,
          SUM(tax_amount) as tax,
          COUNT(DISTINCT customer_id) as unique_customers,
          SUM(CASE WHEN payment_method = 'cash' THEN paid_amount ELSE 0 END) as cash_sales,
          SUM(CASE WHEN payment_method = 'card' THEN paid_amount ELSE 0 END) as card_sales
        FROM sales 
        WHERE DATE(sale_date) >= ? AND DATE(sale_date) <= ? AND status = 'completed'
        GROUP BY DATE(sale_date)
        ORDER BY date DESC
      `).all(date_from, date_to);

            // Top products
            const topProducts = db.prepare(`
        SELECT p.name, SUM(si.quantity) as qty_sold, SUM(si.total_price) as revenue,
               SUM(si.quantity * (p.selling_price - p.cost_price)) as profit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? AND s.status = 'completed'
        GROUP BY p.id
        ORDER BY revenue DESC
        LIMIT 10
      `).all(date_from, date_to);

            // Expenses
            const expenses = db.prepare(`
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE DATE(expense_date) >= ? AND DATE(expense_date) <= ?
        GROUP BY category
      `).all(date_from, date_to);

            // Total calculations
            const totals = db.prepare(`
        SELECT SUM(total_amount) as total_revenue,
               COUNT(*) as total_transactions,
               SUM(discount_amount) as total_discount
        FROM sales
        WHERE DATE(sale_date) >= ? AND DATE(sale_date) <= ? AND status = 'completed'
      `).get(date_from, date_to);

            const totalExpensesAmount = db.prepare(`
        SELECT SUM(amount) as total FROM expenses
        WHERE DATE(expense_date) >= ? AND DATE(expense_date) <= ?
      `).get(date_from, date_to);

            res.json({
                success: true,
                dailySales,
                topProducts,
                expenses,
                totals: {
                    revenue: totals.total_revenue || 0,
                    transactions: totals.total_transactions || 0,
                    discount: totals.total_discount || 0,
                    expenses: totalExpensesAmount.total || 0
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    exportExcel: (req, res) => {
        try {
            const { type, date_from, date_to } = req.body;
            const db = getDb();

            if (!type) {
                return res.status(400).json({ success: false, message: 'Report type is required' });
            }

            let workbook = XLSX.utils.book_new();
            let filename = `export_${type}_${dayjs().format('YYYY-MM-DD_HHmmss')}.xlsx`;

            if (type === 'sales_summary') {
                // Daily sales summary
                const dailySales = db.prepare(`
                    SELECT 
                        DATE(sale_date) as date,
                        COUNT(*) as transactions,
                        SUM(total_amount) as revenue,
                        SUM(discount_amount) as discount,
                        SUM(tax_amount) as tax,
                        COUNT(DISTINCT customer_id) as unique_customers,
                        SUM(CASE WHEN payment_method = 'cash' THEN paid_amount ELSE 0 END) as cash_sales,
                        SUM(CASE WHEN payment_method = 'card' THEN paid_amount ELSE 0 END) as card_sales
                    FROM sales 
                    WHERE DATE(sale_date) >= ? AND DATE(sale_date) <= ? AND status = 'completed'
                    GROUP BY DATE(sale_date)
                    ORDER BY date DESC
                `).all(date_from || '2024-01-01', date_to || dayjs().format('YYYY-MM-DD'));

                // Top products
                const topProducts = db.prepare(`
                    SELECT 
                        p.name, 
                        SUM(si.quantity) as qty_sold, 
                        SUM(si.total_price) as revenue,
                        SUM(si.quantity * (p.selling_price - p.cost_price)) as profit
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    JOIN sales s ON si.sale_id = s.id
                    WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? AND s.status = 'completed'
                    GROUP BY p.id
                    ORDER BY revenue DESC
                    LIMIT 20
                `).all(date_from || '2024-01-01', date_to || dayjs().format('YYYY-MM-DD'));

                // Expenses by category
                const expenses = db.prepare(`
                    SELECT category, SUM(amount) as total, COUNT(*) as count
                    FROM expenses
                    WHERE DATE(expense_date) >= ? AND DATE(expense_date) <= ?
                    GROUP BY category
                    ORDER BY total DESC
                `).all(date_from || '2024-01-01', date_to || dayjs().format('YYYY-MM-DD'));

                // Total calculations
                const totals = db.prepare(`
                    SELECT 
                        SUM(total_amount) as total_revenue,
                        COUNT(*) as total_transactions,
                        SUM(discount_amount) as total_discount,
                        AVG(total_amount) as avg_transaction
                    FROM sales
                    WHERE DATE(sale_date) >= ? AND DATE(sale_date) <= ? AND status = 'completed'
                `).get(date_from || '2024-01-01', date_to || dayjs().format('YYYY-MM-DD'));

                const totalExpensesAmount = db.prepare(`
                    SELECT SUM(amount) as total FROM expenses
                    WHERE DATE(expense_date) >= ? AND DATE(expense_date) <= ?
                `).get(date_from || '2024-01-01', date_to || dayjs().format('YYYY-MM-DD'));

                // Sheet 1: Daily Sales Summary
                const dailySalesSheet = XLSX.utils.json_to_sheet(
                    dailySales.map(row => ({
                        'Date': row.date,
                        'Transactions': row.transactions,
                        'Revenue': Number(row.revenue || 0).toFixed(2),
                        'Discount': Number(row.discount || 0).toFixed(2),
                        'Tax': Number(row.tax || 0).toFixed(2),
                        'Unique Customers': row.unique_customers,
                        'Cash Sales': Number(row.cash_sales || 0).toFixed(2),
                        'Card Sales': Number(row.card_sales || 0).toFixed(2)
                    }))
                );
                dailySalesSheet['!cols'] = [
                    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
                ];
                XLSX.utils.book_append_sheet(workbook, dailySalesSheet, 'Daily Sales');

                // Sheet 2: Top Products
                const topProductsSheet = XLSX.utils.json_to_sheet(
                    topProducts.map(row => ({
                        'Product Name': row.name,
                        'Quantity Sold': row.qty_sold,
                        'Revenue': Number(row.revenue || 0).toFixed(2),
                        'Profit': Number(row.profit || 0).toFixed(2)
                    }))
                );
                topProductsSheet['!cols'] = [
                    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
                ];
                XLSX.utils.book_append_sheet(workbook, topProductsSheet, 'Top Products');

                // Sheet 3: Expenses by Category
                const expensesSheet = XLSX.utils.json_to_sheet(
                    expenses.map(row => ({
                        'Category': row.category,
                        'Total Amount': Number(row.total || 0).toFixed(2),
                        'Count': row.count
                    }))
                );
                expensesSheet['!cols'] = [
                    { wch: 20 }, { wch: 15 }, { wch: 10 }
                ];
                XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');

                // Sheet 4: Summary Statistics
                const summaryData = [
                    { 'Metric': 'Total Revenue', 'Value': Number(totals.total_revenue || 0).toFixed(2) },
                    { 'Metric': 'Total Transactions', 'Value': totals.total_transactions || 0 },
                    { 'Metric': 'Total Discount', 'Value': Number(totals.total_discount || 0).toFixed(2) },
                    { 'Metric': 'Average Transaction', 'Value': Number(totals.avg_transaction || 0).toFixed(2) },
                    { 'Metric': 'Total Expenses', 'Value': Number(totalExpensesAmount.total || 0).toFixed(2) },
                    { 'Metric': 'Net Profit', 'Value': Number((totals.total_revenue || 0) - (totalExpensesAmount.total || 0)).toFixed(2) },
                    { 'Metric': 'Report Period', 'Value': `${date_from || '2024-01-01'} to ${date_to || dayjs().format('YYYY-MM-DD')}` }
                ];
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                summarySheet['!cols'] = [
                    { wch: 25 }, { wch: 20 }
                ];
                XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
            } else {
                // Default: Return error for unsupported types
                return res.status(400).json({
                    success: false,
                    message: `Report type '${type}' is not supported`
                });
            }

            // Ensure temp directory exists
            const tempDir = path.join(os.tmpdir(), 'bigmart-exports');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const filepath = path.join(tempDir, filename);
            XLSX.writeFile(workbook, filepath);

            // Return filepath and filename instead of streaming
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(filepath);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
