import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ElectronService } from '../../../core/services/electron.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Product, Category, Customer, CartItem, Sale } from '../../../core/models';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.scss']})
export class PosComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];

  cart: any[] = [];
  searchTerm = '';
  selectedCategory = '';
  selectedCustomer: Customer | null = null;
  customerSearch = '';
  showCustomerDropdown = false;
  discountInput = 0;

  processing = false;
  showPaymentModal = false;
  paymentMethod: 'cash' | 'card' = 'cash';

  @ViewChild('searchInput') searchInput!: ElementRef;

  constructor(
    private electronService: ElectronService, 
    private authService: AuthService,
    private confirmService: ConfirmService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  @HostListener('window:keydown.f1', ['$event'])
  handleF1(event: any) {
    if (event.preventDefault) event.preventDefault();
    this.searchInput.nativeElement.focus();
  }

  async loadData() {
    try {
      this.products = await this.electronService.getProducts({ is_active: 1 });
      this.categories = await this.electronService.getCategories();
      this.customers = await this.electronService.getCustomers({ is_active: 1 });
      this.applyFilters();
    } catch (err) { console.error(err); }
  }

  applyFilters() {
    this.filteredProducts = this.products.filter(p => {
      const matchesSearch = !this.searchTerm ||
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(this.searchTerm));
      const matchesCat = !this.selectedCategory || p.category_id === this.selectedCategory;
      return matchesSearch && matchesCat;
    });

    this.filteredCustomers = this.customers.filter(c =>
      c.name.toLowerCase().includes(this.customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(this.customerSearch))
    );
  }

  selectCategory(catId: string) {
    this.selectedCategory = catId;
    this.applyFilters();
  }

  addToCart(product: Product) {
    if (product.stock_quantity <= 0) return;

    const existing = this.cart.find(i => i.product_id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) {
        this.updateQuantity(existing, 1);
      }
    } else {
      const item = {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.selling_price,
        quantity: 1,
        total_price: product.selling_price,
        barcode: product.barcode,
        max_stock: product.stock_quantity
      };
      this.cart.push(item);
    }
  }

  updateQuantity(item: any, change: number) {
    const newQty = item.quantity + change;
    if (newQty < 1) return;
    if (newQty > item.max_stock) return;

    item.quantity = newQty;
    item.total_price = item.quantity * item.unit_price;
  }

  removeFromCart(item: any) {
    this.cart = this.cart.filter(i => i.product_id !== item.product_id);
  }

  async clearCart() {
    const confirmed = await this.confirmService.confirm({
      title: 'Clear Cart',
      message: 'Are you sure you want to remove all items from the cart?',
      type: 'danger'
    });
    if (confirmed) this.cart = [];
  }

  selectCustomer(customer: Customer) {
    this.selectedCustomer = customer;
    this.customerSearch = '';
    this.showCustomerDropdown = false;
  }

  hideDropdown() {
    setTimeout(() => this.showCustomerDropdown = false, 200);
  }

  get subtotal() { return this.cart.reduce((sum, i) => sum + i.total_price, 0); }
  get discount() { return this.discountInput || 0; }
  get total() { return Math.max(0, this.subtotal - this.discount); }

  async checkout() {
    if (!this.cart.length) return;
    this.showPaymentModal = true;
  }

  async confirmCheckout() {
    // ✅ Prevent double-submit
    if (this.processing) {
      console.warn('Payment already processing...');
      return;
    }

    this.showPaymentModal = false;
    this.processing = true;

    try {
      const saleData = {
        cashier_id: this.authService.currentUser?.id,
        customer_id: this.selectedCustomer?.id || null,
        items: this.cart,
        payment_method: this.paymentMethod,
        subtotal: this.subtotal,
        total_amount: this.total,
        discount_amount: this.discount,
        tax_amount: 0,
        paid_amount: this.total,
        change_amount: 0
      };

      const result = await this.electronService.createSale(saleData) as any;
      if (result.success) {
        this.confirmService.alert({
          title: 'Sale Completed',
          message: 'Invoice: ' + result.invoiceNumber,
          type: 'success'
        });
        this.cart = [];
        this.selectedCustomer = null;
        this.loadData(); // Refresh stock
      } else {
        this.confirmService.alert({
          title: 'Checkout Error',
          message: result.message || 'Unknown error',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error('[POS Error]', err);
      this.confirmService.alert({
        title: 'Checkout Failed',
        message: (err as any)?.message || 'Unknown error',
        type: 'danger'
      });
    } finally {
      this.processing = false;
    }
  }
}
