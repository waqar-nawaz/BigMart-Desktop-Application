/**
 * electron/main.js
 * ─────────────────
 * Entry point for the Electron main process.
 * Bootstraps the app window, initialises the database,
 * registers IPC handlers, and starts REST API server.
 */

const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('path');

const { createWindow } = require('./src/config/window.config');
const { initDatabase } = require('../backend/src/database/database');
const { registerAllIPC } = require('./src/ipc/ipc.registry');
const { scheduleJobs } = require('../backend/src/utils/scheduler');
const logger = require('../backend/src/utils/logger');
const { startServer } = require('../backend/src/api/api.server');



const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// ─── App Lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  logger.info('BigMart POS starting…');

  // 1. Initialise database (creates tables + seeds if empty)
  initDatabase();
  logger.info('Database initialised');

  // ✅ 👉 ADD THIS RIGHT HERE

  if (isDev) {
    await startServer(); // ✅ controlled start
    logger.info('API started inside Electron');
  }


  // 2. Create the main BrowserWindow
  const win = createWindow(isDev);
  logger.info('Window created');

  // 3. Register every IPC handler (auth, products, sales, …)
  registerAllIPC(win);
  logger.info('IPC handlers registered');

  // 4. Start background jobs (low-stock check, auto-backup, …)
  scheduleJobs(win);
  logger.info('Background jobs scheduled');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(isDev);
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  const db = require('../backend/src/database/database').getDb();
  if (db) db.close();
  logger.info('Database closed. Bye!');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});
