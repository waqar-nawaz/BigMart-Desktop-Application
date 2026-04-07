import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  isAlert?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private confirmSubject = new Subject<any>();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.confirmSubject.next({
      ...options,
      isAlert: false
    });

    return new Promise((resolve) => {
      this.confirmSubject.asObservable().subscribe((result: any) => {
        if (typeof result === 'boolean') {
          resolve(result);
        }
      });
    });
  }

  alert(options: ConfirmOptions): Promise<void> {
    this.confirmSubject.next({
      ...options,
      isAlert: true
    });
    return Promise.resolve();
  }

  getConfirmRequest(): Observable<any> {
    return this.confirmSubject.asObservable();
  }

  respond(value: boolean) {
    this.confirmSubject.next(value);
  }
}
