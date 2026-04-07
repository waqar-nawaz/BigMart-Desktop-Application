import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { AuthService } from '../../../core/services/auth.service';
import { Expense } from '../../../core/models';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']})
export class ExpensesComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];
  searchTerm = '';
  selectedCategory = '';
  loading = false;
  saving = false;
  private refreshInterval: any;
  showModal = false;
  expenseForm!: FormGroup;

  constructor(private electronService: ElectronService, private fb: FormBuilder, public authService: AuthService) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadExpenses();
    // Refresh less aggressively
    this.refreshInterval = setInterval(() => this.loadExpenses(), 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  initForm() {
    this.expenseForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
      category: ['utilities', Validators.required],
      description: ['', Validators.required],
      expense_date: [new Date().toISOString().split('T')[0]],
      payment_method: ['cash'],
      reference: ['']
    });
  }

  async loadExpenses() {
    this.loading = true;
    try {
      this.expenses = await this.electronService.getAllExpenses();
      this.applyFilters();
    } catch (err) { console.error(err); } finally { this.loading = false; }
  }

  applyFilters() {
    this.filteredExpenses = this.expenses.filter(e => {
      const matchesSearch = !this.searchTerm || e.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesCat = !this.selectedCategory || e.category === this.selectedCategory;
      return matchesSearch && matchesCat;
    });
  }

  get totalExpensesAmount() {
    return this.filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }

  openAddModal() {
    this.expenseForm.reset({
      expense_date: new Date().toISOString().split('T')[0],
      category: 'utilities',
      payment_method: 'cash'
    });
    this.showModal = true;
  }

  async saveExpense() {
    if (this.expenseForm.invalid) return;
    this.saving = true;
    try {
      const data = {
        ...this.expenseForm.value,
        recorded_by: this.authService.currentUser?.id
      };
      const result = await this.electronService.createExpense(data);
      if (result.success) {
        this.loadExpenses();
        this.showModal = false;
      } else { alert('Error: ' + result.message); }
    } catch (err) { console.error(err); } finally { this.saving = false; }
  }
}
