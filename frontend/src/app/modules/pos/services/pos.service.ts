import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from '../../../core/services/electron.service';

export interface CartItem {
    product_id: string;
    quantity: number;
    price: number;
    discount?: number;
}

export interface PaymentMethod {
    id: string;
    name: string;
    type: 'cash' | 'card' | 'check';
}

@Injectable({ providedIn: 'root' })
export class PosService {
    private cartSubject = new BehaviorSubject<CartItem[]>([]);
    cart$: Observable<CartItem[]> = this.cartSubject.asObservable();

    constructor(private electronService: ElectronService) { }

    addToCart(item: CartItem): void {
        const current = this.cartSubject.value;
        this.cartSubject.next([...current, item]);
    }

    removeFromCart(productId: string): void {
        const current = this.cartSubject.value;
        this.cartSubject.next(current.filter(item => item.product_id !== productId));
    }

    async checkout(paymentMethod: PaymentMethod): Promise<{ success: boolean }> {
        const items = this.cartSubject.value;
        const result = await this.electronService.createSale({
            items,
            payment_method: paymentMethod.type
        });
        if ((result as any).success) {
            this.cartSubject.next([]); // Clear cart
        }
        return { success: (result as any).success };
    }
}
