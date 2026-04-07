import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Product, Category } from '../../../core/models';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']})
export class InventoryComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];

  searchTerm = '';
  selectedCategory = '';
  stockFilter = 'all';
  loading = false;
  saving = false;

  showModal = false;
  isEditing = false;
  productForm!: FormGroup;

  showAdjustmentModal = false;
  selectedProductAdjust: Product | null = null;
  adjustmentQty = 0;
  adjustmentType: 'add' | 'remove' | 'set' = 'add';
  adjustmentReason = '';
  adjusting = false;

  constructor(
    private electronService: ElectronService,
    private fb: FormBuilder,
    private confirmService: ConfirmService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadData();
  }

  initForm() {
    this.productForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      barcode: [''],
      category_id: [''],
      cost_price: [0, [Validators.required, Validators.min(0)]],
      selling_price: [0, [Validators.required, Validators.min(0)]],
      stock_quantity: [1, [Validators.required, Validators.min(0)]],
      min_stock_level: [5],
      unit: ['pcs']
    });
  }

  async loadData() {
    this.loading = true;
    try {
      this.products = await this.electronService.getProducts();
      this.categories = await this.electronService.getCategories();
      this.applyFilters();
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredProducts = this.products.filter(p => {
      const matchesSearch = !this.searchTerm ||
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(this.searchTerm));

      const matchesCat = !this.selectedCategory || p.category_id === this.selectedCategory;

      let matchesStock = true;
      if (this.stockFilter === 'low') matchesStock = p.stock_quantity <= p.min_stock_level;
      else if (this.stockFilter === 'out') matchesStock = p.stock_quantity <= 0;

      return matchesSearch && matchesCat && matchesStock;
    });
  }

  openAddModal() {
    this.isEditing = false;
    this.productForm.reset({
      cost_price: 0,
      selling_price: 0,
      stock_quantity: 1,
      min_stock_level: 5,
      unit: 'pcs'
    });
    this.showModal = true;
  }

  openEditModal(product: Product) {
    this.isEditing = true;
    this.productForm.patchValue(product);
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveProduct() {
    if (this.productForm.invalid) return;

    this.saving = true;
    try {
      const data = this.productForm.value;
      let result;

      if (this.isEditing) {
        result = await this.electronService.updateProduct(data);
      } else {
        result = await this.electronService.createProduct(data);
      }

      if (result.success) {
        this.loadData();
        this.closeModal();
      } else {
        this.confirmService.alert({
          title: 'Save Error',
          message: result.message || 'Error saving product',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      this.saving = false;
    }
  }

  async deleteProduct(product: Product) {
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete ${product.name}? This action cannot be undone.`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        const result = await this.electronService.deleteProduct(product.id);
        if (result.success) {
          this.loadData();
        } else {
          this.confirmService.alert({
            title: 'Delete Error',
            message: result.message || 'Could not delete product',
            type: 'danger'
          });
        }
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
  }

  openAdjustmentModal(product: Product) {
    this.selectedProductAdjust = product;
    this.adjustmentQty = 0;
    this.adjustmentType = 'add';
    this.adjustmentReason = '';
    this.showAdjustmentModal = true;
  }

  async submitAdjustment() {
    if (!this.selectedProductAdjust || !this.adjustmentReason) return;
    this.adjusting = true;
    try {
      const result = await this.electronService.adjustStock({
        product_id: this.selectedProductAdjust.id,
        adjustment_type: this.adjustmentType,
        adjustment_quantity: this.adjustmentQty,
        reason: this.adjustmentReason
      });

      if (result.success) {
        this.confirmService.alert({
          title: 'Stock Adjusted',
          message: 'Inventory has been updated successfully.',
          type: 'success'
        });
        this.showAdjustmentModal = false;
        this.loadData();
      } else {
        this.confirmService.alert({
          title: 'Adjustment Error',
          message: result.message || 'Could not adjust stock',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.adjusting = false;
    }
  }
}
