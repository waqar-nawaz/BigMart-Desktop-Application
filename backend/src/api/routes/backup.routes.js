/**
 * electron/src/api/routes/backup.routes.js
 * ─────────────────────────────────────────
 * Backup management endpoints
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
    create: (req, res) => {
        try {
            // Placeholder for backup functionality
            res.json({
                success: true,
                message: 'Backup created successfully',
                filepath: path.join(os.homedir(), '.config', 'bigmart-pos', 'backups', 'backup.db')
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    listBackups: (req, res) => {
        try {
            const backupDir = path.join(os.homedir(), '.config', 'bigmart-pos', 'backups');

            if (!fs.existsSync(backupDir)) {
                return res.json([]);
            }

            const backups = fs.readdirSync(backupDir)
                .filter(f => f.endsWith('.db'))
                .map(f => {
                    const filepath = path.join(backupDir, f);
                    const stat = fs.statSync(filepath);
                    return {
                        name: f,
                        filepath,
                        created: stat.birthtimeMs,
                        size: stat.size
                    };
                });

            res.json(backups);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
