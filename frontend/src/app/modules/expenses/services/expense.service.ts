import { Injectable } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { Expense } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
    constructor(private electronService: ElectronService) { }

    async loadExpenses(): Promise<Expense[]> {
        return this.electronService.getAllExpenses();
    }

    async createExpense(data: Partial<Expense>): Promise<{ success: boolean }> {
        return this.electronService.createExpense(data);
    }
}
