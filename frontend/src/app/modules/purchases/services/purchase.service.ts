import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Purchase {
    id: string;
    supplier_id: string;
    amount: number;
    items: any[];
    created_at: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
    private purchasesSubject = new BehaviorSubject<Purchase[]>([]);
    purchases$: Observable<Purchase[]> = this.purchasesSubject.asObservable();

    constructor() { }

    async loadPurchases(): Promise<Purchase[]> {
        return [];
    }

    async createPurchase(data: Partial<Purchase>): Promise<{ success: boolean }> {
        return { success: false };
    }
}
