import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from '../../../core/services/electron.service';
import { Sale } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class SaleService {
    private salesSubject = new BehaviorSubject<Sale[]>([]);
    sales$: Observable<Sale[]> = this.salesSubject.asObservable();

    constructor(private electronService: ElectronService) { }

    async loadSales(filters?: any): Promise<Sale[]> {
        const sales = await this.electronService.getAllSales(filters);
        this.salesSubject.next(sales as Sale[]);
        return sales as Sale[];
    }

    async generateReport(filters?: any): Promise<any> {
        return this.electronService.getSalesSummary(filters);
    }
}
