/**
 * electron/src/api/routes/settings.routes.js
 * ───────────────────────────────────────────
 * Settings management endpoints
 */

const { getDb } = require('../../database/database');

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

            Object.entries(settingsData).forEach(([key, value]) => {
                db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, value);
            });

            res.json({ success: true, message: 'Settings updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
