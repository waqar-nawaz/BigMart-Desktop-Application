import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Purchase } from '../../../core/models';

@Component({
  selector: 'app-purchase-detail',
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['./purchase-detail.component.scss']
})
export class PurchaseDetailComponent implements OnInit {
  purchaseId = '';
  purchase: Purchase | null = null;
  loading = true;
  receiving = false;
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private electronService: ElectronService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.purchaseId = params['id'];
      if (this.purchaseId) {
        this.loadPurchase();
      }
    });
  }

  async loadPurchase() {
    this.loading = true;
    try {
      this.purchase = await this.electronService.getPurchaseById(this.purchaseId);
    } catch (e) {
      console.error(e);
      this.confirmService.alert({
        title: 'Error',
        message: 'Error loading purchase order. It might have been deleted.',
        type: 'danger'
      });
      this.router.navigate(['/purchases']);
    } finally {
      this.loading = false;
    }
  }

  toggleReceive() {
    this.receiving = !this.receiving;
    if (this.receiving && this.purchase && this.purchase.items) {
      // Auto-fill receive amounts with remaining amounts
      this.purchase.items.forEach(item => {
        item.quantity_received = item.quantity_ordered - (item.quantity_received || 0);
      });
    }
  }

  async submitReceive() {
    if (!this.purchase || !this.purchase.items) return;
    this.saving = true;
    try {
      // Construct payload expected by POST /purchases/receive
      // It likely expects: purchaseId, items: [{id, quantity_received, unit_cost, product_id}]
      const receiveData = {
        purchaseId: this.purchase.id,
        items: this.purchase.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost
        }))
      };

      const res = await this.electronService.receivePurchase(receiveData);
      if (res?.success) {
        this.confirmService.alert({
          title: 'Success',
          message: 'Items received successfully and inventory updated.',
          type: 'success'
        });
        this.receiving = false;
        this.loadPurchase();
      } else {
        this.confirmService.alert({
          title: 'Error',
          message: res?.message || 'Error receiving items',
          type: 'danger'
        });
      }
    } catch (e) {
      console.error(e);
      this.confirmService.alert({
        title: 'Failed',
        message: 'Failed to receive items. Please check if product IDs are valid.',
        type: 'danger'
      });
    } finally {
      this.saving = false;
    }
  }
}
