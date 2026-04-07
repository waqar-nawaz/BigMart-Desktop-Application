import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Customer } from '../../../core/models';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']})
export class CustomersComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm = '';
  loading = false;
  saving = false;
  private refreshInterval: any;

  showModal = false;
  isEditing = false;
  customerForm!: FormGroup;

  constructor(
    private electronService: ElectronService,
    private fb: FormBuilder,
    private confirmService: ConfirmService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCustomers();
    // Refresh less aggressively
    this.refreshInterval = setInterval(() => {
      if (document.hidden) return;
      this.loadCustomers();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  initForm() {
    this.customerForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
      customer_type: ['regular'],
      address: [''],
      loyalty_points: [0]
    });
  }

  async loadCustomers() {
    this.loading = true;
    try {
      this.customers = await this.electronService.getCustomers();
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredCustomers = this.customers.filter(c =>
      c.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(this.searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  openAddModal() {
    this.isEditing = false;
    this.customerForm.reset({
      customer_type: 'regular',
      loyalty_points: 0
    });
    this.showModal = true;
  }

  openEditModal(customer: Customer) {
    this.isEditing = true;
    this.customerForm.patchValue(customer);
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveCustomer() {
    if (this.customerForm.invalid) return;

    this.saving = true;
    try {
      const data = this.customerForm.value;
      let result;

      if (this.isEditing) {
        result = await this.electronService.updateCustomer(data);
      } else {
        result = await this.electronService.createCustomer(data);
      }

      if (result.success) {
        this.loadCustomers();
        this.closeModal();
      } else {
        this.confirmService.alert({
          title: 'Save Error',
          message: result.message || 'Error saving customer',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.saving = false;
    }
  }

  async deleteCustomer(customer: Customer) {
    const confirmed = await this.confirmService.confirm({
      title: 'Deactivate Customer',
      message: `Are you sure you want to deactivate ${customer.name}? They will no longer appear in POS searches.`,
      type: 'warning'
    });

    if (confirmed) {
      try {
        const result = await this.electronService.updateCustomer({ ...customer, is_active: 0 });
        if (result.success) {
          this.loadCustomers();
        } else {
          this.confirmService.alert({
            title: 'Action Failed',
            message: result.message || 'Could not deactivate customer',
            type: 'danger'
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}
