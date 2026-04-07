import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Supplier, Product } from '../../../core/models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-purchase-form',
  templateUrl: './purchase-form.component.html',
  styleUrls: ['./purchase-form.component.scss']
})
export class PurchaseFormComponent implements OnInit {
  poForm!: FormGroup;
  suppliers: Supplier[] = [];
  products: Product[] = [];
  saving = false;

  constructor(
    private fb: FormBuilder,
    private electronService: ElectronService,
    private authService: AuthService,
    private router: Router,
    private confirmService: ConfirmService
  ) {
    this.createForm();
  }

  ngOnInit() {
    this.loadData();
  }

  createForm() {
    this.poForm = this.fb.group({
      supplier_id: ['', Validators.required],
      expected_date: [''],
      notes: [''],
      items: this.fb.array([])
    });
  }

  get items(): FormArray {
    return this.poForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      quantity_ordered: [1, [Validators.required, Validators.min(1)]],
      unit_cost: [0, [Validators.required, Validators.min(0)]]
    });
  }

  addItem() {
    this.items.push(this.createItem());
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  async loadData() {
    try {
      this.suppliers = await this.electronService.getSuppliers({ is_active: 1 });
      this.products = await this.electronService.getProducts({ is_active: 1 });
      if (this.items.length === 0) {
        this.addItem(); // Add one default row
      }
    } catch (e) { console.error(e); }
  }

  onProductChange(index: number) {
    const itemRow = this.items.at(index);
    const productId = itemRow.get('product_id')?.value;
    if (productId) {
      const product = this.products.find(p => p.id === productId);
      if (product) {
        itemRow.patchValue({ unit_cost: product.cost_price });
      }
    }
  }

  get subtotal() {
    let total = 0;
    this.items.controls.forEach(control => {
      total += (control.get('quantity_ordered')?.value || 0) * (control.get('unit_cost')?.value || 0);
    });
    return total;
  }

  async submit() {
    if (this.poForm.invalid || this.items.length === 0) {
      this.confirmService.alert({
        title: 'Validation Error',
        message: 'Please fill out all required fields and add at least one item.',
        type: 'warning'
      });
      return;
    }
    
    this.saving = true;
    try {
      const formValue = this.poForm.value;
      const subT = this.subtotal;
      
      const purchaseData = {
        supplier_id: formValue.supplier_id,
        expected_date: formValue.expected_date,
        notes: formValue.notes,
        subtotal: subT,
        tax_amount: 0,
        total_amount: subT,
        created_by: this.authService.currentUser?.id,
        items: formValue.items.map((i: any) => {
          const prod = this.products.find(p => p.id === i.product_id);
          return {
            product_id: i.product_id,
            product_name: prod?.name,
            quantity_ordered: i.quantity_ordered,
            unit_cost: i.unit_cost,
            total_cost: i.quantity_ordered * i.unit_cost
          };
        })
      };

      const res = await this.electronService.createPurchase(purchaseData);
      if (res?.success) {
        this.confirmService.alert({
          title: 'Success',
          message: 'Purchase Order created successfully.',
          type: 'success'
        });
        this.router.navigate(['/purchases']);
      } else {
        this.confirmService.alert({
          title: 'Error',
          message: res?.message || 'Error creating Purchase Order',
          type: 'danger'
        });
      }
    } catch (e) {
      console.error(e);
      this.confirmService.alert({
        title: 'Error',
        message: 'Failed to submit Purchase Order.',
        type: 'danger'
      });
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.router.navigate(['/purchases']);
  }
}
