/**
 * electron/src/services/setting.service.js
 */
const { getDb } = require('../database/database');

const SettingService = {
    get(key) {
        const db = getDb();
        return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
    },
    getAll() {
        const db = getDb();
        const rows = db.prepare('SELECT key,value FROM settings').all();
        const obj = {};
        rows.forEach(r => obj[r.key] = r.value);
        return obj;
    },
    updateMany(settings) {
        const db = getDb();
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))");
        db.transaction((s) => { Object.entries(s).forEach(([k, v]) => stmt.run(k, String(v))); })(settings);
        return { success: true };
    },
};

module.exports = SettingService;
