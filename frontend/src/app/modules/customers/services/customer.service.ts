import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    loyalty_points?: number;
    total_spent?: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
    private customersSubject = new BehaviorSubject<Customer[]>([]);
    customers$: Observable<Customer[]> = this.customersSubject.asObservable();

    constructor() { }

    async loadCustomers(): Promise<Customer[]> {
        return [];
    }

    async createCustomer(data: Partial<Customer>): Promise<{ success: boolean }> {
        return { success: false };
    }

    async updateCustomer(id: string, data: Partial<Customer>): Promise<{ success: boolean }> {
        return { success: false };
    }
}
