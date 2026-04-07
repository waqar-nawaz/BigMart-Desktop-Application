import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';

// Components
import { LoginComponent } from './modules/auth/components/login.component';
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';
import { DashboardComponent } from './modules/dashboard/components/dashboard.component';
import { PosComponent } from './modules/pos/components/pos.component';
import { InventoryComponent } from './modules/inventory/components/inventory.component';
import { SalesComponent } from './modules/sales/components/sales.component';
import { PurchasesComponent } from './modules/purchases/components/purchases.component';
import { PurchaseFormComponent } from './modules/purchases/components/purchase-form.component';
import { PurchaseDetailComponent } from './modules/purchases/components/purchase-detail.component';
import { CustomersComponent } from './modules/customers/components/customers.component';
import { CustomerDetailComponent } from './modules/customers/components/customer-detail.component';
import { SuppliersComponent } from './modules/suppliers/components/suppliers.component';
import { EmployeesComponent } from './modules/employees/components/employees.component';
import { ReportsComponent } from './modules/reports/components/reports.component';
import { SettingsComponent } from './modules/settings/components/settings.component';
import { ExpensesComponent } from './modules/expenses/components/expenses.component';
import { ShiftsComponent } from './modules/shifts/components/shifts.component';
import { LowStockComponent } from './modules/inventory/components/low-stock.component';

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent,
        MainLayoutComponent,
        DashboardComponent,
        PosComponent,
        InventoryComponent,
        SalesComponent,
        PurchasesComponent,
        PurchaseFormComponent,
        PurchaseDetailComponent,
        CustomersComponent,
        CustomerDetailComponent,
        SuppliersComponent,
        EmployeesComponent,
        ReportsComponent,
        SettingsComponent,
        ExpensesComponent,
        ShiftsComponent,
        LowStockComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        CoreModule,
        SharedModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }
// Component registration updated

