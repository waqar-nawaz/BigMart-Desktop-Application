#!/usr/bin/env node
/**
 * Starts the same full API surface used by Electron.
 * Keeps browser/standalone mode behavior consistent with desktop mode.
 */
const { startServer } = require('./api.server');

if (require.main === module) {
  const port = Number(process.env.API_PORT || 3000);
  startServer(port).catch((err) => {
    console.error('[API] Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
