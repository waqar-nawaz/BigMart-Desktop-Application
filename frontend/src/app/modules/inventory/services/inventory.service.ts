import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    category_id?: string;
    price: number;
    cost_price?: number;
    quantity: number;
    reorder_level?: number;
    image_url?: string;
    is_active: number;
}

export interface Category {
    id: string;
    name: string;
    description?: string;
}

export interface StockAdjustment {
    id: string;
    product_id: string;
    quantity_change: number;
    reason: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
    private productsSubject = new BehaviorSubject<Product[]>([]);
    products$: Observable<Product[]> = this.productsSubject.asObservable();

    constructor() { }

    async loadProducts(filters?: any): Promise<Product[]> {
        return [];
    }

    async getProductByBarcode(barcode: string): Promise<Product | null> {
        return null;
    }

    async createProduct(data: Partial<Product>): Promise<{ success: boolean; id?: string }> {
        return { success: false };
    }

    async updateProduct(id: string, data: Partial<Product>): Promise<{ success: boolean }> {
        return { success: false };
    }
}
