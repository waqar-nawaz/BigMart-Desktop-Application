/**
 * angular-app/src/app/core/services/auth.service.ts
 * ────────────────────────────────────────────────────
 * Manages the authenticated user state and active shift.
 * All components check auth state through this service.
 *
 * HOW TO ADD ROLE CHECKS:
 *   1. Add a getter below (e.g. get isSuperAdmin())
 *   2. Use it in templates: *ngIf="authService.isSuperAdmin"
 *   3. Add it to RoleGuard data if needed
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ElectronService } from './electron.service';
import { User, Shift } from '../models';

const USER_STORAGE_KEY = 'bigmart_current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private userSubject = new BehaviorSubject<User | null>(null);
  private shiftSubject = new BehaviorSubject<Shift | null>(null);

  currentUser$: Observable<User | null> = this.userSubject.asObservable();
  activeShift$: Observable<Shift | null> = this.shiftSubject.asObservable();

  constructor(private electronService: ElectronService, private router: Router) {
    // Restore user from localStorage on app boot
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try { this.userSubject.next(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }

  // ── Getters ───────────────────────────────────────────────
  get currentUser(): User | null { return this.userSubject.value; }
  get activeShift(): Shift | null { return this.shiftSubject.value; }
  get isLoggedIn(): boolean { return !!this.currentUser; }
  get isAdmin(): boolean { return this.currentUser?.role === 'admin'; }
  get isManager(): boolean { return ['admin', 'manager'].includes(this.currentUser?.role || ''); }
  get isCashier(): boolean { return !!this.currentUser; } // all roles can act as cashier

  hasRole(roles: string[]): boolean { return roles.includes(this.currentUser?.role || ''); }

  // ── Login / Logout ────────────────────────────────────────
  async login(username: string, password: string) {
    const result = await this.electronService.login({ username, password });
    if (result?.success && result?.user) {
      this.setUser(result.user);
      await this.loadActiveShift();
    }
    return result;
  }

  async pinLogin(pin: string) {
    const result = await this.electronService.pinLogin({ pin });
    if (result?.success && result?.user) {
      this.setUser(result.user);
      await this.loadActiveShift();
    }
    return result;
  }

  logout() {
    this.userSubject.next(null);
    this.shiftSubject.next(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  // ── Shift Management ──────────────────────────────────────
  async loadActiveShift() {
    if (!this.currentUser) return;
    const shift = await this.electronService.getActiveShift(this.currentUser.id);
    this.shiftSubject.next(shift);
  }

  setActiveShift(shift: Shift | null) { this.shiftSubject.next(shift); }

  // ── Private ───────────────────────────────────────────────
  private setUser(user: User) {
    this.userSubject.next(user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}
