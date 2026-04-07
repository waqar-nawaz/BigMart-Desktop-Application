import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Employee {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    salary?: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
    private employeesSubject = new BehaviorSubject<Employee[]>([]);
    employees$: Observable<Employee[]> = this.employeesSubject.asObservable();

    constructor() { }

    async loadEmployees(): Promise<Employee[]> {
        return [];
    }

    async createEmployee(data: Partial<Employee>): Promise<{ success: boolean }> {
        return { success: false };
    }
}
