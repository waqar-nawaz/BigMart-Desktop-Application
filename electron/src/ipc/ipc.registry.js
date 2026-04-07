/**
 * electron/src/ipc/ipc.registry.js
 * ────────────────────────────────────
 * Registers ALL IPC handlers in one place.
 *
 * HOW TO ADD A NEW IPC CHANNEL:
 *   1. Add your handler here using ipcMain.handle('channel:action', ...)
 *   2. Export the function from your controller
 *   3. Add the matching call in electron/src/preload/preload.js
 *   4. Add the matching method in Angular's ElectronService
 *
 * Pattern:  'resource:action'   e.g.  'products:getAll'
 */

const { ipcMain } = require('electron');
const {
  AuthController, ProductController, SaleController, CustomerController,
  InventoryController, PurchaseController, SupplierController,
  ShiftController, ExpenseController, ReportController,
  SettingsController, BackupController, SystemController,
} = require('../../../backend/src/controllers/controllers');

function registerAllIPC(mainWindow) {

  // ── WINDOW CONTROLS ──────────────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.on('window:close', () => mainWindow.close());
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());

  // ── AUTH ─────────────────────────────────────────────────
  ipcMain.handle('auth:login', (e, { username, password }) => AuthController.login(username, password));
  ipcMain.handle('auth:pinLogin', (e, { pin }) => AuthController.pinLogin(pin));
  ipcMain.handle('auth:changePassword', (e, { userId, oldPassword, newPassword }) =>
    AuthController.changePassword(userId, oldPassword, newPassword));

  // ── USERS / EMPLOYEES ────────────────────────────────────
  ipcMain.handle('users:getAll', () => AuthController.getAllUsers());
  ipcMain.handle('users:create', (e, data) => AuthController.createUser(data));
  ipcMain.handle('users:update', (e, { id, ...data }) => AuthController.updateUser(id, data));

  // ── DASHBOARD ────────────────────────────────────────────
  ipcMain.handle('dashboard:stats', (e, { period }) => ReportController.getDashboardStats(period));

  // ── PRODUCTS ─────────────────────────────────────────────
  ipcMain.handle('products:getAll', (e, filters) => ProductController.getAll(filters));
  ipcMain.handle('products:getById', (e, id) => ProductController.getById(id));
  ipcMain.handle('products:getByBarcode', (e, barcode) => ProductController.getByBarcode(barcode));
  ipcMain.handle('products:create', (e, data) => ProductController.create(data));
  ipcMain.handle('products:update', (e, { id, ...data }) => ProductController.update(id, data));
  ipcMain.handle('products:delete', (e, id) => ProductController.delete(id));
  ipcMain.handle('products:saveImage', (e, { productId, imageData, extension }) =>
    ProductController.saveImage(productId, imageData, extension));
  ipcMain.handle('products:getImage', (e, imagePath) => ProductController.getImage(imagePath));
  ipcMain.handle('products:bulkImport', (e, { filePath }) => ProductController.bulkImport(filePath));
  ipcMain.handle('products:getLowStock', () => ProductController.getLowStock());

  // ── CATEGORIES ───────────────────────────────────────────
  ipcMain.handle('categories:getAll', () => ProductController.getAllCategories());
  ipcMain.handle('categories:create', (e, data) => ProductController.createCategory(data));
  ipcMain.handle('categories:update', (e, { id, ...data }) => ProductController.updateCategory(id, data));

  // ── SALES / POS ──────────────────────────────────────────
  ipcMain.handle('sales:create', (e, data) => SaleController.create(data));
  ipcMain.handle('sales:getById', (e, id) => SaleController.getById(id));
  ipcMain.handle('sales:getAll', (e, filters) => SaleController.getAll(filters));
  ipcMain.handle('sales:return', (e, { saleId, reason, items }) =>
    SaleController.processReturn(saleId, reason, items));
  ipcMain.handle('sales:generateReceipt', (e, id) => SaleController.generateReceipt(id));

  // ── CUSTOMERS ────────────────────────────────────────────
  ipcMain.handle('customers:getAll', (e, filters) => CustomerController.getAll(filters));
  ipcMain.handle('customers:getById', (e, id) => CustomerController.getById(id));
  ipcMain.handle('customers:getByPhone', (e, phone) => CustomerController.getByPhone(phone));
  ipcMain.handle('customers:create', (e, data) => CustomerController.create(data));
  ipcMain.handle('customers:update', (e, { id, ...data }) => CustomerController.update(id, data));
  ipcMain.handle('customers:getPurchaseHistory', (e, id) => CustomerController.getPurchaseHistory(id));

  // ── INVENTORY ────────────────────────────────────────────
  ipcMain.handle('inventory:adjust', (e, data) => InventoryController.adjust(data));
  ipcMain.handle('inventory:getAdjustments', (e, filters) => InventoryController.getAdjustments(filters));

  // ── PURCHASES ────────────────────────────────────────────
  ipcMain.handle('purchases:create', (e, data) => PurchaseController.create(data));
  ipcMain.handle('purchases:receive', (e, { purchaseId, items, receivedDate }) =>
    PurchaseController.receive(purchaseId, items, receivedDate));
  ipcMain.handle('purchases:getAll', (e, filters) => PurchaseController.getAll(filters));
  ipcMain.handle('purchases:getById', (e, id) => PurchaseController.getById(id));

  // ── SUPPLIERS ────────────────────────────────────────────
  ipcMain.handle('suppliers:getAll', (e, filters) => SupplierController.getAll(filters));
  ipcMain.handle('suppliers:create', (e, data) => SupplierController.create(data));
  ipcMain.handle('suppliers:update', (e, { id, ...data }) => SupplierController.update(id, data));

  // ── SHIFTS ───────────────────────────────────────────────
  ipcMain.handle('shifts:open', (e, { cashierId, openingCash }) => ShiftController.open(cashierId, openingCash));
  ipcMain.handle('shifts:close', (e, { shiftId, closingCash, notes }) => ShiftController.close(shiftId, closingCash, notes));
  ipcMain.handle('shifts:getActive', (e, cashierId) => ShiftController.getActive(cashierId));
  ipcMain.handle('shifts:getAll', () => ShiftController.getAll());

  // ── EXPENSES ─────────────────────────────────────────────
  ipcMain.handle('expenses:getAll', (e, filters) => ExpenseController.getAll(filters));
  ipcMain.handle('expenses:create', (e, data) => ExpenseController.create(data));

  // ── REPORTS ──────────────────────────────────────────────
  ipcMain.handle('reports:salesSummary', (e, { date_from, date_to }) => ReportController.getSalesSummary(date_from, date_to));

  // Export Excel with file save dialog
  ipcMain.handle('reports:exportExcel', async (event, result) => {
    try {
      const { dialog, shell, app } = require('electron'); // ← add app here
      const fs = require('fs');
      const path = require('path');

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Excel Report',
        defaultPath: path.join(app.getPath('downloads'), result.filename), // ← Downloads folder
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        properties: ['createDirectory']
      });

      if (!filePath) return { success: false, message: 'Save cancelled by user' };

      fs.copyFileSync(result.filepath, filePath);
      shell.showItemInFolder(filePath); // ← opens folder and highlights the file

      return { success: true, filepath: filePath, message: 'Report saved successfully' };

    } catch (err) {
      return { success: false, message: `Save failed: ${err.message}` };
    }
  });

  // ── SETTINGS ─────────────────────────────────────────────
  ipcMain.handle('settings:getAll', () => SettingsController.getAll());
  ipcMain.handle('settings:update', (e, data) => SettingsController.update(data));

  // ── BACKUP ───────────────────────────────────────────────
  ipcMain.handle('backup:create', () => BackupController.create());
  ipcMain.handle('backup:listBackups', () => BackupController.listBackups());

  // ── FILE DIALOGS ─────────────────────────────────────────
  const { dialog } = require('electron');
  ipcMain.handle('dialog:openFile', (e, opts) => dialog.showOpenDialog(mainWindow, opts || { properties: ['openFile'] }));
  ipcMain.handle('dialog:saveFile', (e, opts) => dialog.showSaveDialog(mainWindow, opts || {}));
  ipcMain.handle('dialog:openDirectory', () => dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }));

  // ── SYSTEM ───────────────────────────────────────────────
  ipcMain.handle('system:getInfo', () => SystemController.getInfo());
  ipcMain.handle('system:openDataFolder', () => SystemController.openDataFolder());
  ipcMain.handle('system:openReportsFolder', () => SystemController.openReportsFolder());
}

module.exports = { registerAllIPC };
