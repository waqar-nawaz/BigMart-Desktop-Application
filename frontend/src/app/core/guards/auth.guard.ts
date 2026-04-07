/**
 * angular-app/src/app/core/guards/auth.guard.ts
 * ─────────────────────────────────────────────────
 * Protects routes that require authentication.
 * Redirects to /login if not logged in.
 */
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn) return true;
    this.router.navigate(['/login']);
    return false;
  }
}


/**
 * angular-app/src/app/core/guards/role.guard.ts
 * ────────────────────────────────────────────────
 * Protects routes by user role.
 * Usage in routing: canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
 *
 * HOW TO ADD A PROTECTED ROUTE:
 *   { path: 'employees', component: EmployeesComponent,
 *     canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] } }
 */
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const allowedRoles = route.data['roles'] as string[];
    if (!allowedRoles || this.authService.hasRole(allowedRoles)) return true;
    this.router.navigate(['/dashboard']);
    return false;
  }
}
