import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ReportService {
    constructor() { }

    async generateSalesReport(filters?: any): Promise<any> {
        return {};
    }

    async generateInventoryReport(filters?: any): Promise<any> {
        return {};
    }

    async generateProfitReport(filters?: any): Promise<any> {
        return {};
    }
}
