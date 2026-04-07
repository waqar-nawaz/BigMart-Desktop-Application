import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { SalesSummaryReport } from '../../../core/models';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']})
export class ReportsComponent implements OnInit {
  report: any = null;
  dateFrom = '';
  dateTo = '';
  loading = false;
  exporting = false;

  constructor(private electronService: ElectronService) { }

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dateFrom = today;
    this.dateTo = today;
    this.loadReport();
  }

  async loadReport() {
    this.loading = true;
    try {
      this.report = await this.electronService.getSalesSummary({
        date_from: this.dateFrom,
        date_to: this.dateTo
      });
    } catch (err) { console.error(err); } finally { this.loading = false; }
  }

  get totalRevenue() { return this.report?.totals?.revenue || 0; }
  get totalProfit() { return this.report?.topProducts?.reduce((sum: number, p: any) => sum + (p.profit || 0), 0) || 0; }
  get totalTransactions() { return this.report?.totals?.transactions || 0; }
  get totalExpenses() { return this.report?.totals?.expenses || 0; }

  async exportToExcel() {
    this.exporting = true;
    try {
      const result = await this.electronService.exportExcel({
        type: 'sales_summary',
        date_from: this.dateFrom,
        date_to: this.dateTo
      });

      if (!result.success) {
        alert('Export failed: ' + result.message);
      }
      // ✅ File downloads automatically — no dialog needed

    } catch (err) {
      alert('Unexpected error during export');
    } finally {
      this.exporting = false;
    }
  }


}
