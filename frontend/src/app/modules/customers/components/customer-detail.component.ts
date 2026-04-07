import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from '../../../core/services/electron.service';
import { Customer, Sale } from '../../../core/models';

@Component({
  selector: 'app-customer-detail',
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss']
})
export class CustomerDetailComponent implements OnInit {
  customerId: string = '';
  customer: Customer | null = null;
  history: Sale[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private electronService: ElectronService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.customerId = params['id'];
      if (this.customerId) {
        this.loadData();
      }
    });
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      this.customer = await this.electronService.getCustomerById(this.customerId);
      this.history = await this.electronService.getCustomerPurchaseHistory(this.customerId);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/customers']);
  }
}
