import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Supplier } from '../../../core/models';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.scss']})
export class SuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  searchTerm = '';
  loading = false;
  saving = false;
  showModal = false;
  isEditing = false;
  supplierForm!: FormGroup;

  constructor(
    private electronService: ElectronService, 
    private fb: FormBuilder,
    private confirmService: ConfirmService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  initForm() {
    this.supplierForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      contact_person: [''],
      email: ['', Validators.email],
      phone: [''],
      city: [''],
      payment_terms: [30],
      address: ['']
    });
  }

  async loadSuppliers() {
    this.loading = true;
    try {
      this.suppliers = await this.electronService.getSuppliers();
      this.applyFilters();
    } catch (err) { console.error(err); } finally { this.loading = false; }
  }

  applyFilters() {
    this.filteredSuppliers = this.suppliers.filter(s =>
      s.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  openAddModal() {
    this.isEditing = false;
    this.supplierForm.reset({ payment_terms: 30 });
    this.showModal = true;
  }

  openEditModal(supplier: Supplier) {
    this.isEditing = true;
    this.supplierForm.patchValue(supplier);
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  async saveSupplier() {
    if (this.supplierForm.invalid) return;
    this.saving = true;
    try {
      const data = this.supplierForm.value;
      const result = this.isEditing
        ? await this.electronService.updateSupplier(data)
        : await this.electronService.createSupplier(data);

      if (result.success) {
        this.loadSuppliers();
        this.closeModal();
      } else {
        this.confirmService.alert({
          title: 'Save Error',
          message: result.message || 'Error saving supplier',
          type: 'danger'
        });
      }
    } catch (err) { console.error(err); } finally { this.saving = false; }
  }

  async deleteSupplier(supplier: Supplier) {
    const confirmed = await this.confirmService.confirm({
      title: 'Deactivate Supplier',
      message: `Are you sure you want to deactivate ${supplier.name}? They will no longer appear in Purchase Order searches.`,
      type: 'warning'
    });

    if (confirmed) {
      try {
        const result = await this.electronService.updateSupplier({ ...supplier, is_active: 0 });
        if (result.success) {
          this.loadSuppliers();
        } else {
          this.confirmService.alert({
            title: 'Action Failed',
            message: result.message || 'Could not deactivate supplier',
            type: 'danger'
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}
