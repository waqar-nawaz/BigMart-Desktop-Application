/**
 * angular-app/src/app/core/services/electron.service.ts
 * ────────────────────────────────────────────────────────
 * Universal backend wrapper supporting multiple modes:
 * 1. HTTP API (preferred - works in Electron & Browser)
 * 2. IPC (fallback for Electron without API server)
 * 3. Mock data (fallback for pure browser without Electron)
 *
 * Single command works everywhere: npm run dev
 */

import { Injectable } from '@angular/core';
import {
  User, AuthResult, Product, Category, Customer, Sale, Purchase,
  Supplier, Shift, Expense, AppSettings, DashboardStats,
  SalesSummaryReport, ApiResponse
} from '../models';

declare global {
  interface Window { electronAPI: any; }
}

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private apiUrl = 'http://localhost:3000/api';
  private hasElectron = !!(window && window.electronAPI);
  private apiAvailable: boolean | null = null; // null = not checked yet
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  get isElectron(): boolean {
    return this.hasElectron;
  }

  // Check if HTTP API is available
  private async isApiAvailable(): Promise<boolean> {
    if (this.apiAvailable !== null) return this.apiAvailable;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      this.apiAvailable = response.ok;
      if (this.apiAvailable) {
        console.log('✓ HTTP API available at localhost:3000');
      }
    } catch (err) {
      this.apiAvailable = false;
    }
    return this.apiAvailable;
  }

  // Generic HTTP call helper
  private async apiCall<T>(method: string, endpoint: string, data?: any): Promise<T> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
      const options: RequestInit = {
        method,
        headers,
      };
      if (data) options.body = JSON.stringify(data);

      const response = await fetch(`${this.apiUrl}${endpoint}`, options);
      const result = await response.json();
      return result;
    } catch (err) {
      console.error('API call failed:', err);
      throw err;
    }
  }

  // ── Window ────────────────────────────────────────────────
  minimizeWindow() { if (this.hasElectron) window.electronAPI?.window.minimize(); }
  maximizeWindow() { if (this.hasElectron) window.electronAPI?.window.maximize(); }
  closeWindow() { if (this.hasElectron) window.electronAPI?.window.close(); }
  isMaximized(): Promise<boolean> {
    return this.hasElectron ? window.electronAPI?.window.isMaximized() : Promise.resolve(false);
  }

  // ── Auth ─────────────────────────────────────────────────
  async login(credentials: { username: string; password: string }): Promise<AuthResult> {
    try {
      const result = await this.apiCall<AuthResult>('POST', '/auth/login', credentials);
      return result;
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Login failed' };
    }
  }

  async pinLogin(data: { pin: string }): Promise<AuthResult> {
    try {
      const result = await this.apiCall<AuthResult>('POST', '/auth/pinLogin', data);
      return result;
    } catch (err) {
      console.error('PIN login error:', err);
      return { success: false, message: 'PIN login failed' };
    }
  }

  changePassword(data: { userId: string; oldPassword: string; newPassword: string }) {
    return this.apiCall('POST', '/auth/changePassword', data);
  }

  // ── Dashboard ────────────────────────────────────────────
  getDashboardStats(period = 'today'): Promise<DashboardStats> {
    return this.apiCall('GET', `/dashboard/stats?period=${period}`);
  }

  // ── Products ─────────────────────────────────────────────
  getProducts(filters?: Partial<{ search: string; category_id: string; is_active: number; low_stock: boolean; limit: number; offset: number }>): Promise<Product[]> {
    const queryParams = new URLSearchParams(filters as any).toString();
    return this.apiCall('GET', `/products${queryParams ? '?' + queryParams : ''}`);
  }
  getProductById(id: string): Promise<Product> { return this.apiCall('GET', `/products/${id}`); }
  getProductByBarcode(b: string): Promise<Product | null> { return this.apiCall('GET', `/products/barcode/${b}`); }
  createProduct(data: Partial<Product>): Promise<ApiResponse> { return this.apiCall('POST', '/products', data); }
  updateProduct(data: Partial<Product> & { id: string }): Promise<ApiResponse> { return this.apiCall('PUT', `/products/${data.id}`, data); }
  deleteProduct(id: string): Promise<ApiResponse> { return this.apiCall('DELETE', `/products/${id}`); }
  saveProductImage(d: { productId: string; imageData: string; extension: string }): Promise<ApiResponse> { return this.apiCall('POST', '/products/image/save', d); }
  getProductImage(path: string): Promise<string | null> { return this.apiCall('GET', `/products/image/${path}`); }
  bulkImportProducts(d: { filePath: string }): Promise<{ success: boolean; imported: number; failed: number; total: number }> { return this.apiCall('POST', '/products/import', d); }
  getLowStockProducts(): Promise<Product[]> { return this.apiCall('GET', '/products/low-stock'); }

  // ── Categories ───────────────────────────────────────────
  getCategories(): Promise<Category[]> { return this.apiCall('GET', '/categories'); }
  createCategory(d: Partial<Category>): Promise<ApiResponse> { return this.apiCall('POST', '/categories', d); }
  updateCategory(d: Partial<Category> & { id: string }): Promise<ApiResponse> { return this.apiCall('PUT', `/categories/${d.id}`, d); }

  // ── Customers ────────────────────────────────────────────
  getCustomers(f?: any): Promise<Customer[]> { return this.apiCall('GET', '/customers'); }
  getCustomerById(id: string): Promise<Customer> { return this.apiCall('GET', `/customers/${id}`); }
  getCustomerByPhone(phone: string): Promise<Customer | null> { return this.apiCall('GET', `/customers/phone/${phone}`); }
  createCustomer(d: Partial<Customer>): Promise<ApiResponse> { return this.apiCall('POST', '/customers', d); }
  updateCustomer(d: Partial<Customer> & { id: string }): Promise<ApiResponse> { return this.apiCall('PUT', `/customers/${d.id}`, d); }
  getCustomerPurchaseHistory(id: string): Promise<Sale[]> { return this.apiCall('GET', `/customers/${id}/history`); }

  // ── Sales ────────────────────────────────────────────────
  createSale(data: any): Promise<{ success: boolean; saleId: string; invoiceNumber: string }> { return this.apiCall('POST', '/sales', data); }
  getSaleById(id: string): Promise<Sale> { return this.apiCall('GET', `/sales/${id}`); }
  getAllSales(f?: any): Promise<Sale[]> {
    let url = '/sales';
    if (f) {
      const params = new URLSearchParams();
      if (f.date_from) params.append('date_from', f.date_from);
      if (f.date_to) params.append('date_to', f.date_to);
      if (f.customer_id) params.append('customer_id', f.customer_id);
      if (f.payment_method) params.append('payment_method', f.payment_method);
      if (params.toString()) url += '?' + params.toString();
    }
    return this.apiCall('GET', url);
  }
  returnSale(d: any): Promise<ApiResponse> {
    // Backward/forward compatibility mapping:
    // backend expects { saleId, returnReason }
    if (d && (d.sale_id || d.reason) && (!d.saleId && !d.returnReason)) {
      return this.apiCall('POST', '/sales/return', {
        saleId: d.sale_id,
        returnReason: d.reason,
      });
    }
    return this.apiCall('POST', '/sales/return', d);
  }
  generateReceipt(id: string): Promise<{ sale: Sale; settings: AppSettings }> { return this.apiCall('POST', `/sales/${id}/receipt`, {}); }

  // ── Inventory ────────────────────────────────────────────
  adjustStock(d: any): Promise<ApiResponse> { return this.apiCall('POST', '/inventory/adjust', d); }
  getStockAdjustments(f?: any): Promise<any[]> { return this.apiCall('GET', '/inventory/adjustments'); }

  // ── Purchases ────────────────────────────────────────────
  createPurchase(d: any): Promise<ApiResponse & { poNumber?: string }> { return this.apiCall('POST', '/purchases', d); }
  receivePurchase(d: any): Promise<ApiResponse> { return this.apiCall('POST', '/purchases/receive', d); }
  getAllPurchases(f?: any): Promise<Purchase[]> { return this.apiCall('GET', '/purchases'); }
  getPurchaseById(id: string): Promise<Purchase> { return this.apiCall('GET', `/purchases/${id}`); }

  // ── Suppliers ────────────────────────────────────────────
  getSuppliers(f?: any): Promise<Supplier[]> { return this.apiCall('GET', '/suppliers'); }
  createSupplier(d: Partial<Supplier>): Promise<ApiResponse> { return this.apiCall('POST', '/suppliers', d); }
  updateSupplier(d: Partial<Supplier> & { id: string }): Promise<ApiResponse> { return this.apiCall('PUT', `/suppliers/${d.id}`, d); }

  // ── Users ────────────────────────────────────────────────
  getAllUsers(): Promise<User[]> { return this.apiCall('GET', '/users'); }
  createUser(d: any): Promise<ApiResponse> { return this.apiCall('POST', '/users', d); }
  updateUser(d: any): Promise<ApiResponse> { return this.apiCall('PUT', `/users/${d.id}`, d); }

  // ── Shifts ───────────────────────────────────────────────
  openShift(d: any): Promise<ApiResponse & { shiftId?: string }> { return this.apiCall('POST', '/shifts/open', d); }
  closeShift(d: any): Promise<ApiResponse> { return this.apiCall('POST', '/shifts/close', d); }
  getActiveShift(cashierId: string): Promise<Shift | null> { return this.apiCall('GET', `/shifts/active/${cashierId}`); }
  getAllShifts(): Promise<Shift[]> { return this.apiCall('GET', '/shifts'); }

  // ── Expenses ─────────────────────────────────────────────
  getAllExpenses(f?: any): Promise<Expense[]> { return this.apiCall('GET', '/expenses'); }
  createExpense(d: any): Promise<ApiResponse> { return this.apiCall('POST', '/expenses', d); }

  // ── Reports ──────────────────────────────────────────────
  getSalesSummary(d: { date_from: string; date_to: string }): Promise<SalesSummaryReport> { return this.apiCall('POST', '/reports/sales-summary', d); }
  async exportExcel(d: { type: string; date_from?: string; date_to?: string }): Promise<ApiResponse & { filepath?: string }> {
    // Just trigger a direct download via hidden anchor tag
    const params = JSON.stringify(d);

    const response = await fetch(`${this.apiUrl}/reports/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params
    });

    if (!response.ok) {
      return { success: false, message: 'Export failed' };
    }

    // Convert response to blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${d.date_from}_${d.date_to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return { success: true, message: 'Download started' };
  }

  // ── Settings ─────────────────────────────────────────────
  getSettings(): Promise<AppSettings> { return this.apiCall('GET', '/settings'); }
  updateSettings(s: Partial<AppSettings>): Promise<ApiResponse> { return this.apiCall('PUT', '/settings', s); }

  // ── Backup ───────────────────────────────────────────────
  createBackup(): Promise<ApiResponse & { path?: string }> { return this.apiCall('POST', '/backup/create', {}); }
  listBackups(): Promise<any[]> { return this.apiCall('GET', '/backup/list'); }

  // ── Dialogs ──────────────────────────────────────────────
  openFile(opts?: any): Promise<{ canceled: boolean; filePaths: string[] }> { return this.hasElectron ? window.electronAPI?.dialog.openFile(opts) : Promise.resolve({ canceled: true, filePaths: [] }); }
  saveFile(opts?: any): Promise<{ canceled: boolean; filePath?: string }> { return this.hasElectron ? window.electronAPI?.dialog.saveFile(opts) : Promise.resolve({ canceled: true }); }
  openDirectory(): Promise<{ canceled: boolean; filePaths: string[] }> { return this.hasElectron ? window.electronAPI?.dialog.openDirectory() : Promise.resolve({ canceled: true, filePaths: [] }); }

  // ── System ───────────────────────────────────────────────
  getSystemInfo(): Promise<any> { return this.hasElectron ? window.electronAPI?.system.getInfo() : Promise.resolve({}); }
  openDataFolder(): Promise<void> { return this.hasElectron ? window.electronAPI?.system.openDataFolder() : Promise.resolve(); }
  openReportsFolder(): Promise<void> { return this.hasElectron ? window.electronAPI?.system.openReportsFolder() : Promise.resolve(); }

  // ── Event Listeners (Main → Renderer) ────────────────────
  on(channel: string, callback: (...args: any[]) => void): void { if (this.hasElectron) window.electronAPI?.on(channel, callback); }
  off(channel: string): void { if (this.hasElectron) window.electronAPI?.off(channel); }
}
