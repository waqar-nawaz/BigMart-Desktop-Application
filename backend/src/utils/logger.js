/**
 * electron/src/utils/logger.js
 * ─────────────────────────────
 * Simple console logger with timestamps and log levels.
 * In production you can swap this for a file-based logger (winston, pino).
 *
 * HOW TO ADD FILE LOGGING:
 *   npm install winston
 *   Replace console.log calls with winston.createLogger({ transports: [new winston.transports.File()] })
 */

const dayjs = require('dayjs');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET  = '\x1b[0m';

const currentLevel = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;
  const ts    = dayjs().format('HH:mm:ss');
  const color = COLORS[level] || '';
  const tag   = `[${ts}] [${level.toUpperCase().padEnd(5)}]`;
  console.log(`${color}${tag}${RESET}`, ...args);
}

const logger = {
  error: (...args) => log('error', ...args),
  warn:  (...args) => log('warn',  ...args),
  info:  (...args) => log('info',  ...args),
  debug: (...args) => log('debug', ...args),
};

module.exports = logger;
