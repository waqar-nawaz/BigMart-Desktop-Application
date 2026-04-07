/**
 * electron/src/preload/preload.js
 * ────────────────────────────────
 * Runs in an isolated context BEFORE the renderer loads.
 * Uses contextBridge to expose a safe, typed API to Angular.
 *
 * SECURITY RULES:
 *   - Only expose methods that Angular actually needs
 *   - Never expose ipcRenderer directly
 *   - Validate channel names in 'on()' listener
 *
 * HOW TO ADD A NEW CHANNEL:
 *   1. Add an ipcMain.handle in ipc.registry.js
 *   2. Add the matching wrapper here
 *   3. Add the method in Angular's ElectronService
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Window Controls ────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // ── Auth ────────────────────────────────────────────────
  auth: {
    login: (c) => ipcRenderer.invoke('auth:login', c),
    pinLogin: (d) => ipcRenderer.invoke('auth:pinLogin', d),
    changePassword: (d) => ipcRenderer.invoke('auth:changePassword', d),
  },

  // ── Dashboard ───────────────────────────────────────────
  dashboard: {
    getStats: (period) => ipcRenderer.invoke('dashboard:stats', { period }),
  },

  // ── Products ────────────────────────────────────────────
  products: {
    getAll: (f) => ipcRenderer.invoke('products:getAll', f),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    getByBarcode: (b) => ipcRenderer.invoke('products:getByBarcode', b),
    create: (d) => ipcRenderer.invoke('products:create', d),
    update: (d) => ipcRenderer.invoke('products:update', d),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    saveImage: (d) => ipcRenderer.invoke('products:saveImage', d),
    getImage: (p) => ipcRenderer.invoke('products:getImage', p),
    bulkImport: (d) => ipcRenderer.invoke('products:bulkImport', d),
    getLowStock: () => ipcRenderer.invoke('products:getLowStock'),
  },

  // ── Categories ──────────────────────────────────────────
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (d) => ipcRenderer.invoke('categories:create', d),
    update: (d) => ipcRenderer.invoke('categories:update', d),
  },

  // ── Customers ───────────────────────────────────────────
  customers: {
    getAll: (f) => ipcRenderer.invoke('customers:getAll', f),
    getById: (id) => ipcRenderer.invoke('customers:getById', id),
    getByPhone: (ph) => ipcRenderer.invoke('customers:getByPhone', ph),
    create: (d) => ipcRenderer.invoke('customers:create', d),
    update: (d) => ipcRenderer.invoke('customers:update', d),
    getPurchaseHistory: (id) => ipcRenderer.invoke('customers:getPurchaseHistory', id),
  },

  // ── Sales / POS ─────────────────────────────────────────
  sales: {
    create: (d) => ipcRenderer.invoke('sales:create', d),
    getById: (id) => ipcRenderer.invoke('sales:getById', id),
    getAll: (f) => ipcRenderer.invoke('sales:getAll', f),
    return: (d) => ipcRenderer.invoke('sales:return', d),
    generateReceipt: (id) => ipcRenderer.invoke('sales:generateReceipt', id),
  },

  // ── Inventory ───────────────────────────────────────────
  inventory: {
    adjust: (d) => ipcRenderer.invoke('inventory:adjust', d),
    getAdjustments: (f) => ipcRenderer.invoke('inventory:getAdjustments', f),
  },

  // ── Purchases ───────────────────────────────────────────
  purchases: {
    create: (d) => ipcRenderer.invoke('purchases:create', d),
    receive: (d) => ipcRenderer.invoke('purchases:receive', d),
    getAll: (f) => ipcRenderer.invoke('purchases:getAll', f),
    getById: (id) => ipcRenderer.invoke('purchases:getById', id),
  },

  // ── Suppliers ───────────────────────────────────────────
  suppliers: {
    getAll: (f) => ipcRenderer.invoke('suppliers:getAll', f),
    create: (d) => ipcRenderer.invoke('suppliers:create', d),
    update: (d) => ipcRenderer.invoke('suppliers:update', d),
  },

  // ── Users / Employees ───────────────────────────────────
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    create: (d) => ipcRenderer.invoke('users:create', d),
    update: (d) => ipcRenderer.invoke('users:update', d),
  },

  // ── Shifts ──────────────────────────────────────────────
  shifts: {
    open: (d) => ipcRenderer.invoke('shifts:open', d),
    close: (d) => ipcRenderer.invoke('shifts:close', d),
    getActive: (id) => ipcRenderer.invoke('shifts:getActive', id),
    getAll: () => ipcRenderer.invoke('shifts:getAll'),
  },

  // ── Expenses ────────────────────────────────────────────
  expenses: {
    getAll: (f) => ipcRenderer.invoke('expenses:getAll', f),
    create: (d) => ipcRenderer.invoke('expenses:create', d),
  },

  // ── Reports ─────────────────────────────────────────────
  reports: {
    salesSummary: (d) => ipcRenderer.invoke('reports:salesSummary', d),
    exportExcel: (d) => ipcRenderer.invoke('reports:exportExcel', d),
  },

  // ── Settings ────────────────────────────────────────────
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (d) => ipcRenderer.invoke('settings:update', d),
  },

  // ── Backup ──────────────────────────────────────────────
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    listBackups: () => ipcRenderer.invoke('backup:listBackups'),
  },

  // ── Dialogs ─────────────────────────────────────────────
  dialog: {
    openFile: (o) => ipcRenderer.invoke('dialog:openFile', o),
    saveFile: (o) => ipcRenderer.invoke('dialog:saveFile', o),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  },

  // ── System ──────────────────────────────────────────────
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    openDataFolder: () => ipcRenderer.invoke('system:openDataFolder'),
    openReportsFolder: () => ipcRenderer.invoke('system:openReportsFolder'),
  },
  reports: {
    exportExcel: (result) => ipcRenderer.invoke('reports:exportExcel', result),
  },

  // ── Push notifications FROM main TO renderer ─────────────
  on: (channel, cb) => {
    const SAFE = ['notification:lowStock', 'barcode:scanned', 'printer:status', 'system:update'];
    if (SAFE.includes(channel)) ipcRenderer.on(channel, (_, ...args) => cb(...args));
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
