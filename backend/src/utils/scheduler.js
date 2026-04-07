/**
 * electron/src/utils/scheduler.js
 * ─────────────────────────────────
 * Runs background jobs on timers:
 *   - Low stock check every 60 min
 *   - Auto-backup daily
 *
 * HOW TO ADD A NEW JOB:
 *   1. Write your function below
 *   2. Call setInterval(yourFn, intervalMs) inside scheduleJobs()
 */

const { getDb }   = require('../database/database');
const notifier    = require('node-notifier');
const logger      = require('./logger');
const path        = require('path');
const os          = require('os');
let electronApp;
try { electronApp = require('electron').app; } catch { electronApp = null; }
const app = electronApp || { getPath: () => path.join(os.homedir(), '.config', 'bigmart-pos') };

function scheduleJobs(mainWindow) {

  // ── Low stock check ─────────────────────────────────────
  function checkLowStock() {
    try {
      const db       = getDb();
      const lowItems = db.prepare(`
        SELECT name, stock_quantity, min_stock_level
        FROM products
        WHERE stock_quantity <= min_stock_level AND is_active = 1
        LIMIT 10
      `).all();

      if (lowItems.length > 0) {
        const names = lowItems.slice(0, 3).map(i => i.name).join(', ');
        const msg   = `${lowItems.length} item(s) running low: ${names}${lowItems.length > 3 ? '…' : ''}`;
        logger.warn(`[LowStock] ${msg}`);

        // OS desktop notification
        notifier.notify({ title: '⚠ BigMart — Low Stock Alert', message: msg, sound: true });

        // Push to renderer (Angular)
        mainWindow?.webContents.send('notification:lowStock', { count: lowItems.length, items: lowItems });
      }
    } catch (e) { logger.error('[LowStock] Check failed:', e.message); }
  }

  // ── Auto-backup ─────────────────────────────────────────
  function autoBackup() {
    try {
      const db       = getDb();
      const settings = db.prepare("SELECT value FROM settings WHERE key='backup_enabled'").get();
      if (settings?.value !== 'true') return;

      const dayjs      = require('dayjs');
      const fs         = require('fs');
      const backupDir  = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      const filename   = `auto_backup_${dayjs().format('YYYY-MM-DD')}.db`;
      const backupPath = path.join(backupDir, filename);

      // Don't overwrite if already done today
      if (fs.existsSync(backupPath)) return;

      db.backup(backupPath);
      logger.info(`[AutoBackup] Created: ${backupPath}`);

      // Keep only last 30 backups
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
        .sort((a, b) => b.time - a.time);

      files.slice(30).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f.name));
        logger.debug(`[AutoBackup] Removed old backup: ${f.name}`);
      });
    } catch (e) { logger.error('[AutoBackup] Failed:', e.message); }
  }

  // Run immediately on startup then on schedule
  checkLowStock();
  autoBackup();

  setInterval(checkLowStock, 60 * 60 * 1000);        // every 1 hour
  setInterval(autoBackup,    24 * 60 * 60 * 1000);   // every 24 hours

  logger.info('[Scheduler] Jobs registered: low-stock-check, auto-backup');
}

module.exports = { scheduleJobs };
