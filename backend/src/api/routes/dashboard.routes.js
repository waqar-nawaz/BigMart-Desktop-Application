/**
 * electron/src/api/routes/dashboard.routes.js
 * ────────────────────────────────────────────
 * Dashboard statistics endpoints
 */

const { getDb } = require('../../database/database');
const dayjs = require('dayjs');

module.exports = {
    getStats: (req, res) => {
        try {
            const { period = 'today' } = req.query;
            const db = getDb();

            let dateFilter = `DATE(sale_date) = DATE('now')`;
            if (period === 'week') {
                dateFilter = `DATE(sale_date) >= DATE('now', '-7 days')`;
            } else if (period === 'month') {
                dateFilter = `strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')`;
            } else if (period === 'year') {
                dateFilter = `strftime('%Y', sale_date) = strftime('%Y', 'now')`;
            }

            // Calculate sales metrics
            const salesStats = db.prepare(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(total_amount) as total_revenue,
          SUM(discount_amount) as total_discount,
          AVG(total_amount) as avg_transaction,
          SUM(paid_amount) as cash_collected
        FROM sales 
        WHERE ${dateFilter} AND status = 'completed'
      `).get();

            // Get top products
            const topProducts = db.prepare(`
        SELECT 
          p.id, p.name, p.selling_price,
          SUM(si.quantity) as quantity_sold,
          SUM(si.total_price) as revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE ${dateFilter} AND s.status = 'completed'
        GROUP BY p.id
        ORDER BY quantity_sold DESC
        LIMIT 10
      `).all();

            // Get inventory status
            const lowStock = db.prepare(`
        SELECT id, name, stock_quantity, min_stock_level 
        FROM products 
        WHERE stock_quantity <= min_stock_level AND is_active = 1
      `).all();

            // Get customer metrics
            const customerStats = db.prepare(`
        SELECT 
          COUNT(DISTINCT customer_id) as total_customers,
          COUNT(*) as repeat_customers
        FROM sales 
        WHERE ${dateFilter}
      `).get();

            // Get recent sales
            const recentSales = db.prepare(`
        SELECT s.*, c.name as customer_name, COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE ${dateFilter}
        GROUP BY s.id
        ORDER BY s.sale_date DESC
        LIMIT 10
      `).all();

            // Load items for recent sales
            recentSales.forEach(sale => {
                sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
            });

            res.json({
                success: true,
                todaySales: { total: salesStats.total_revenue || 0, count: salesStats.total_transactions || 0 },
                lowStockCount: { count: lowStock.length },
                totalCustomers: { count: customerStats.total_customers || 0 },
                pendingPOs: { count: 0 },
                recentSales,
                topProducts: topProducts.map(p => ({ ...p, qty_sold: p.quantity_sold, revenue: p.revenue }))
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
