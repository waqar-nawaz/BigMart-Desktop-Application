import { Injectable } from '@angular/core';

export interface Shift {
    id: string;
    cashier_id: string;
    start_time: string;
    end_time?: string;
    opening_amount: number;
    closing_amount?: number;
}

@Injectable({ providedIn: 'root' })
export class ShiftService {
    constructor() { }

    async startShift(cashierId: string, openingAmount: number): Promise<{ success: boolean }> {
        return { success: false };
    }

    async endShift(shiftId: string, closingAmount: number): Promise<{ success: boolean }> {
        return { success: false };
    }
}
