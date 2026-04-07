/**
 * electron/src/api/routes/backup.routes.js
 * ─────────────────────────────────────────
 * Backup management endpoints
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const dayjs = require('dayjs');
const { getDb } = require('../../database/database');
const AuditService = require('../../services/audit.service');

module.exports = {
    create: (req, res) => {
        try {
            const db = getDb();
            const backupDir = path.join(os.homedir(), '.config', 'bigmart-pos', 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const filename = `bigmart_backup_${dayjs().format('YYYY-MM-DD_HH-mm')}.db`;
            const filepath = path.join(backupDir, filename);
            db.backup(filepath);

            const userId = (req.user && req.user.sub) || null;
            AuditService.log({
                userId,
                action: 'backup.create',
                tableName: null,
                recordId: null,
                oldValues: null,
                newValues: { filepath }
            });

            res.json({
                success: true,
                message: 'Backup created successfully',
                path: filepath
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
