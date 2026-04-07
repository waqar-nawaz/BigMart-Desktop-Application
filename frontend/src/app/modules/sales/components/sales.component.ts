import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Sale } from '../../../core/models';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']})
export class SalesComponent implements OnInit, OnDestroy {
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  searchTerm = '';
  dateFrom = '';
  dateTo = '';
  loading = false;
  selectedSale: Sale | null = null;
  private refreshInterval: any;
  showReturnModal = false;
  returnReason = '';
  returnProcessing = false;

  constructor(private electronService: ElectronService, private confirmService: ConfirmService) { }

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dateFrom = today;
    this.dateTo = today;
    this.loadSales();
    // Refresh less aggressively
    this.refreshInterval = setInterval(() => {
      if (document.hidden) return;
      this.loadSales();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async loadSales() {
    this.loading = true;
    try {
      // Make sure dates are in proper format
      if (!this.dateFrom) this.dateFrom = new Date().toISOString().split('T')[0];
      if (!this.dateTo) this.dateTo = new Date().toISOString().split('T')[0];

      this.sales = await this.electronService.getAllSales({
        date_from: this.dateFrom,
        date_to: this.dateTo
      });
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredSales = this.sales.filter(s =>
      s.invoice_number.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  viewDetails(sale: Sale) {
    this.selectedSale = sale;
  }

  async printReceipt(sale: Sale) {
    try {
      const result = await this.electronService.generateReceipt(sale.id);
      console.log('Receipt data generated:', result);
      this.confirmService.alert({
        title: 'Printing Receipt',
        message: 'Invoice ' + sale.invoice_number + ' has been sent to the printer.',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      this.confirmService.alert({
        title: 'Print Error',
        message: 'Failed to print receipt for ' + sale.invoice_number,
        type: 'danger'
      });
    }
  }

  openReturnModal(sale: Sale) {
    this.selectedSale = sale;
    this.returnReason = '';
    this.showReturnModal = true;
  }

  async processReturn() {
    if (!this.selectedSale) return;
    this.returnProcessing = true;
    try {
      // Process full return
      const res = await this.electronService.returnSale({
        sale_id: this.selectedSale.id,
        reason: this.returnReason || 'Customer requested return'
      });
      if (res?.success) {
        this.confirmService.alert({
          title: 'Return Completed',
          message: 'Sale returned successfully and stock has been restocked.',
          type: 'success'
        });
        this.showReturnModal = false;
        this.selectedSale = null;
        this.loadSales();
      } else {
        this.confirmService.alert({
          title: 'Return Error',
          message: res?.message || 'Error processing return',
          type: 'danger'
        });
      }
    } catch(e) {
      console.error(e);
      this.confirmService.alert({
        title: 'Return Failed',
        message: 'An unexpected error occurred during return processing.',
        type: 'danger'
      });
    } finally {
      this.returnProcessing = false;
    }
  }
}
