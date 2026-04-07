/**
 * angular-app/src/app/app-routing.module.ts
 * ───────────────────────────────────────────
 * Central routing table for the entire Angular app.
 *
 * HOW TO ADD A NEW PAGE/ROUTE:
 *   1. Create your component in the correct module folder
 *   2. Declare it in app.module.ts
 *   3. Add the route below
 *   4. If role-restricted: add canActivate: [RoleGuard], data: { roles: [...] }
 *   5. Add a nav item in main-layout.component.ts navItems array
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/auth.guard';

// ── Lazy-loadable stubs — replace with actual components ──────
// For now these reference the same component file
// In production you would lazy-load each module: loadChildren: () => import(...)
import { LoginComponent }         from './modules/auth/components/login.component';
import { MainLayoutComponent }    from './shared/components/main-layout/main-layout.component';
import { DashboardComponent }     from './modules/dashboard/components/dashboard.component';
import { PosComponent }           from './modules/pos/components/pos.component';
import { InventoryComponent }     from './modules/inventory/components/inventory.component';
import { SalesComponent }         from './modules/sales/components/sales.component';
import { PurchasesComponent }     from './modules/purchases/components/purchases.component';
import { PurchaseFormComponent }  from './modules/purchases/components/purchase-form.component';
import { PurchaseDetailComponent }from './modules/purchases/components/purchase-detail.component';
import { CustomersComponent }     from './modules/customers/components/customers.component';
import { CustomerDetailComponent }from './modules/customers/components/customer-detail.component';
import { SuppliersComponent }     from './modules/suppliers/components/suppliers.component';
import { EmployeesComponent }     from './modules/employees/components/employees.component';
import { ReportsComponent }       from './modules/reports/components/reports.component';
import { SettingsComponent }      from './modules/settings/components/settings.component';
import { ExpensesComponent }      from './modules/expenses/components/expenses.component';
import { ShiftsComponent }        from './modules/shifts/components/shifts.component';
import { LowStockComponent }      from './modules/inventory/components/low-stock.component';

const routes: Routes = [
  // Public (no auth required)
  { path: 'login', component: LoginComponent },

  // Protected (auth required)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '',             redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   component: DashboardComponent },
      { 
        path: 'pos',         component: PosComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager', 'cashier'] } 
      },

      // Inventory
      { path: 'inventory',            component: InventoryComponent },
      { path: 'inventory/low-stock',  component: LowStockComponent },

      // Sales
      { path: 'sales', component: SalesComponent },

      // Purchases
      { 
        path: 'purchases', component: PurchasesComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },
      { 
        path: 'purchases/new', component: PurchaseFormComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },
      { 
        path: 'purchases/:id', component: PurchaseDetailComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },

      // Customers
      { 
        path: 'customers',    component: CustomersComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },
      { 
        path: 'customers/:id',component: CustomerDetailComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },

      // Suppliers
      { 
        path: 'suppliers', component: SuppliersComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },

      // Expenses
      { 
        path: 'expenses', component: ExpensesComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },

      // Shifts
      { 
        path: 'shifts', component: ShiftsComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager', 'cashier'] }
      },

      // Manager+ routes
      {
        path: 'employees', component: EmployeesComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'reports', component: ReportsComponent,
        canActivate: [RoleGuard], data: { roles: ['admin', 'manager'] }
      },

      // Admin only
      {
        path: 'settings', component: SettingsComponent,
        canActivate: [RoleGuard], data: { roles: ['admin'] }
      },
    ]
  },

  // Fallback
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
