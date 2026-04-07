import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmService, ConfirmOptions } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  show = false;
  options: ConfirmOptions = {
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmText: 'Yes, Proceed',
    cancelText: 'Cancel',
    type: 'warning',
    isAlert: false
  };

  private subscription!: Subscription;

  constructor(private confirmService: ConfirmService) { }

  ngOnInit() {
    this.subscription = this.confirmService.getConfirmRequest().subscribe((req) => {
      if (req && typeof req === 'object') {
        this.options = {
          ...this.options,
          ...req,
          confirmText: req.confirmText || (req.isAlert ? 'OK' : 'Yes, Proceed'),
          cancelText: req.cancelText || 'Cancel',
          type: req.type || 'warning'
        };
        this.show = true;
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  confirm() {
    this.show = false;
    this.confirmService.respond(true);
  }

  cancel() {
    this.show = false;
    this.confirmService.respond(false);
  }
}
