import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { Purchase } from '../../../core/models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.scss']
})
export class PurchasesComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  loading = false;
  searchTerm = '';
  selectedStatus = '';

  constructor(private electronService: ElectronService, private router: Router) { }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      this.purchases = await this.electronService.getAllPurchases();
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredPurchases = this.purchases.filter(p => {
      const matchSearch = !this.searchTerm || 
        p.po_number.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchStatus = !this.selectedStatus || p.status === this.selectedStatus;
      return matchSearch && matchStatus;
    });
  }

  viewPurchase(id: string) {
    this.router.navigate(['/purchases', id]);
  }
}
