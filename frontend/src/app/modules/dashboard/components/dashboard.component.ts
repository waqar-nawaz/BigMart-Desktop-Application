import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { DashboardStats } from '../../../core/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']})
export class DashboardComponent implements OnInit {
  stats?: DashboardStats;

  constructor(private electronService: ElectronService) {}

  ngOnInit(): void {
    this.refreshData();
  }

  async refreshData() {
    try {
      this.stats = await this.electronService.getDashboardStats('today');
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }

  getSalesPercent(value: number): number {
    if (!this.stats?.salesByHour?.length) return 0;
    const max = Math.max(...this.stats.salesByHour.map(s => s.total));
    return max > 0 ? (value / max) * 100 : 0;
  }

  getCategoryPercent(value: number): number {
    if (!this.stats?.categoryRevenue?.length) return 0;
    const total = this.stats.categoryRevenue.reduce((sum, c) => sum + c.revenue, 0);
    return total > 0 ? (value / total) * 100 : 0;
  }
}
