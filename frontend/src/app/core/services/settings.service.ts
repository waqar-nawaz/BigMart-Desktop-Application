/**
 * angular-app/src/app/core/services/settings.service.ts
 * ────────────────────────────────────────────────────────
 * Loads and caches app settings from SQLite.
 * Provides helpers like formatCurrency() used across the app.
 *
 * HOW TO ADD A SETTING:
 *   1. Add the key to AppSettings interface in models/index.ts
 *   2. Add the default value in electron/src/database/seed.js
 *   3. Use settingsService.get('my_key') or settingsService.settings.my_key
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ElectronService } from './electron.service';
import { AppSettings } from '../models';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class SettingsService {

  private settingsSubject = new BehaviorSubject<Partial<AppSettings>>({});
  settings$: Observable<Partial<AppSettings>> = this.settingsSubject.asObservable();

  constructor(private electronService: ElectronService) {
    this.loadSettings();
  }

  // ── Load / Save ──────────────────────────────────────────
  async loadSettings(): Promise<AppSettings> {
    const s = await this.electronService.getSettings();
    this.settingsSubject.next(s);
    return s;
  }

  async save(settings: Partial<AppSettings>): Promise<void> {
    await this.electronService.updateSettings(settings);
    await this.loadSettings();
  }

  // ── Getters ───────────────────────────────────────────────
  get settings(): Partial<AppSettings> { return this.settingsSubject.value; }
  get currencySymbol(): string { return this.settings.currency_symbol || 'Rs.'; }
  get storeName(): string { return this.settings.store_name || 'BigMart'; }
  get taxRate(): number { return parseFloat(this.settings.tax_rate || '0'); }
  get loyaltyRate(): number { return parseFloat(this.settings.loyalty_rate || '1'); }
  get loyaltyRedemption(): number { return parseFloat(this.settings.loyalty_redemption || '100'); }
  get invoicePrefix(): string { return this.settings.invoice_prefix || 'BM'; }

  // ── Helpers ───────────────────────────────────────────────
  formatCurrency(amount: number = 0): string {
    return `${this.currencySymbol} ${(amount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  calculateLoyaltyEarned(totalAmount: number): number {
    return Math.floor(totalAmount / this.loyaltyRate);
  }

  loyaltyPointsToDiscount(points: number): number {
    return points / this.loyaltyRedemption;
  }
}


/**
 * angular-app/src/app/core/services/notification.service.ts
 * ─────────────────────────────────────────────────────────────
 * Wraps MatSnackBar for consistent toast notifications.
 * Also listens for Electron push events (low stock, etc.)
 *
 * HOW TO USE:
 *   this.notifications.success('Saved!');
 *   this.notifications.error('Something went wrong');
 *   this.notifications.warn('Low stock detected');
 */

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private lowStockSubject = new Subject<any>();
  lowStock$ = this.lowStockSubject.asObservable();

  constructor(
    private snackBar: MatSnackBar,
    private electronService: ElectronService
  ) {
    // Subscribe to low-stock push from Electron main process
    this.electronService.on('notification:lowStock', (data: any) => {
      this.lowStockSubject.next(data);
      this.warn(`⚠ Low Stock: ${data.items?.[0]?.name} (+${data.count - 1} more)`);
    });
  }

  success(message: string, duration = 3000) {
    this.show(message, 'snack-success', duration);
  }

  error(message: string, duration = 5000) {
    this.show(message, 'snack-error', duration);
  }

  warn(message: string, duration = 4000) {
    this.show(message, 'snack-warn', duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, 'snack-info', duration);
  }

  private show(message: string, panelClass: string, duration: number) {
    this.snackBar.open(message, '✕', {
      duration, panelClass: [panelClass],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
