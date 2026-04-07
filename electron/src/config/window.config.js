/**
 * electron/src/config/window.config.js
 * ──────────────────────────────────────
 * Creates and configures the main BrowserWindow.
 * Kept separate so it can be imported without side-effects.
 */

const { BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow = null;

/**
 * createWindow(isDev)
 * @param {boolean} isDev  - true = load Angular dev server, false = load built files
 * @returns {BrowserWindow}
 */
function createWindow(isDev) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: true,            // Show native title bar with close button
    titleBarStyle: 'default',
    backgroundColor: '#0d1117',
    show: false,            // Show only after 'ready-to-show'
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,   // Security: isolate renderer from Node
      nodeIntegration: false,  // Security: no raw Node in renderer
      sandbox: true           // Enable sandbox for security; contextBridge works with this
    }
  });

  // Load URL
  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    // Open DevTools in same window (right side)
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../../../frontend/dist/bigmart-pos/index.html')
    );
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => { mainWindow = null; });

  // Global shortcuts
  globalShortcut.register('F11', () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  });

  return mainWindow;
}

function getMainWindow() { return mainWindow; }

module.exports = { createWindow, getMainWindow };
