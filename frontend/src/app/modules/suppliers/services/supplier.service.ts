import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Supplier {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
    private suppliersSubject = new BehaviorSubject<Supplier[]>([]);
    suppliers$: Observable<Supplier[]> = this.suppliersSubject.asObservable();

    constructor() { }

    async loadSuppliers(): Promise<Supplier[]> {
        return [];
    }

    async createSupplier(data: Partial<Supplier>): Promise<{ success: boolean }> {
        return { success: false };
    }
}
