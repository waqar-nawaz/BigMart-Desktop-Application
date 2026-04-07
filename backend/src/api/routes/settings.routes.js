/**
 * electron/src/api/routes/settings.routes.js
 * ───────────────────────────────────────────
 * Settings management endpoints
 */

const { getDb } = require('../../database/database');
const AuditService = require('../../services/audit.service');

module.exports = {
    getAll: (req, res) => {
        try {
            const settings = getDb().prepare('SELECT * FROM settings').all();
            const result = {};
            settings.forEach(s => {
                result[s.key] = s.value;
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: (req, res) => {
        try {
            const settingsData = req.body;
            const db = getDb();

            const oldRows = db.prepare('SELECT key, value FROM settings').all();
            const oldMap = Object.fromEntries(oldRows.map(r => [r.key, r.value]));

            Object.entries(settingsData).forEach(([key, value]) => {
                db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, value);
            });

            const userId = (req.user && req.user.sub) || null;
            AuditService.log({
                userId,
                action: 'settings.update',
                tableName: 'settings',
                recordId: null,
                oldValues: oldMap,
                newValues: settingsData
            });

            res.json({ success: true, message: 'Settings updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
