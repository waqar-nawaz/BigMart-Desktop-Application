/**
 * angular-app/src/app/core/models/index.ts
 * ──────────────────────────────────────────
 * Central export of ALL TypeScript interfaces / types.
 * Import from here everywhere: import { Product } from '@core/models'
 *
 * HOW TO ADD A NEW MODEL:
 *   1. Define the interface below
 *   2. Export it
 *   3. Use it in your module's service and components
 */

// ── Auth / Users ────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'cashier' | 'supervisor' | 'accountant';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  pin?: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  message?: string;
}

// ── Category ─────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: number;
  product_count: number;
  created_at: string;
}

// ── Supplier ─────────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tax_number: string | null;
  payment_terms: number;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Product ──────────────────────────────────────────────────
export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  discount_price: number | null;
  tax_rate: number;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  reorder_point: number;
  image_path: string | null;
  is_active: number;
  is_featured: number;
  expiry_date: string | null;
  location: string | null;
  weight: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  supplier_name?: string;
}

// ── Customer ─────────────────────────────────────────────────
export type CustomerType = 'regular' | 'vip' | 'wholesale' | 'staff';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  loyalty_points: number;
  total_purchases: number;
  customer_type: CustomerType;
  date_of_birth: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Cart ─────────────────────────────────────────────────────
export interface CartItem {
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  original_price: number;
  discount_amount: number;
  tax_amount: number;
  total_price: number;
  unit: string;
  stock_quantity: number;
}

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'credit';

export interface PaymentData {
  method: PaymentMethod;
  paid_amount: number;
  change_amount: number;
  reference?: string;
  notes?: string;
  loyalty_points_used?: number;
}

// ── Sale ─────────────────────────────────────────────────────
export type SaleStatus = 'completed' | 'returned' | 'void';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_price: number;
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  cashier_id: string;
  shift_id: string | null;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  discount_type: 'fixed' | 'percent';
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  status: SaleStatus;
  notes: string | null;
  is_returned: number;
  return_reason: string | null;
  loyalty_points_earned: number;
  loyalty_points_used: number;
  created_at: string;
  // Joined
  customer_name?: string;
  cashier_name?: string;
  items?: SaleItem[];
}

// ── Purchase Order ───────────────────────────────────────────
export type POStatus = 'pending' | 'partial' | 'received' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  barcode?: string;
}

export interface Purchase {
  id: string;
  po_number: string;
  supplier_id: string | null;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  status: POStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  supplier_name?: string;
  items?: PurchaseItem[];
}

// ── Stock Adjustment ─────────────────────────────────────────
export type AdjustmentType = 'add' | 'remove' | 'set' | 'damage';

export interface StockAdjustment {
  id: string;
  product_id: string;
  product_name: string;
  adjustment_type: AdjustmentType;
  quantity_before: number;
  adjustment_quantity: number;
  quantity_after: number;
  reason: string;
  adjusted_by: string | null;
  created_at: string;
  // Joined
  adjusted_by_name?: string;
}

// ── Shift ────────────────────────────────────────────────────
export interface Shift {
  id: string;
  cashier_id: string;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  closing_cash: number | null;
  total_sales: number;
  total_transactions: number;
  status: 'open' | 'closed';
  notes: string | null;
  created_at: string;
  // Joined
  cashier_name?: string;
}

// ── Expense ──────────────────────────────────────────────────
export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string;
  reference: string | null;
  recorded_by: string | null;
  created_at: string;
  // Joined
  recorded_by_name?: string;
}

// ── Settings ─────────────────────────────────────────────────
export interface AppSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  currency: string;
  currency_symbol: string;
  tax_rate: string;
  loyalty_rate: string;
  loyalty_redemption: string;
  receipt_footer: string;
  low_stock_threshold: string;
  invoice_prefix: string;
  po_prefix: string;
  printer_enabled: string;
  printer_interface: string;
  backup_enabled: string;
  backup_frequency: string;
  theme: string;
  [key: string]: string;
}

// ── Dashboard ────────────────────────────────────────────────
export interface DashboardStats {
  todaySales: { total: number; count: number };
  totalProducts: { count: number };
  lowStockCount: { count: number };
  totalCustomers: { count: number };
  pendingPOs: { count: number };
  totalExpenses: { total: number };
  topProducts: Array<{ name: string; qty_sold: number; revenue: number }>;
  salesByHour: Array<{ hour: string; total: number }>;
  recentSales: Sale[];
  categoryRevenue: Array<{ name: string; color: string; revenue: number }>;
}

// ── Report ───────────────────────────────────────────────────
export interface SalesSummaryReport {
  paymentBreakdown: Array<{ payment_method: string; count: number; total: number; discounts: number }>;
  dailyTrend: Array<{ date: string; transactions: number; revenue: number; discounts: number }>;
  topProducts: Array<{ name: string; barcode: string; qty_sold: number; revenue: number; profit: number }>;
  expenses: Array<{ category: string; total: number }>;
  hourlyPattern: Array<{ hour: string; avg_sale: number; count: number }>;
  categoryRevenue: Array<{ name: string; color: string; revenue: number }>;
}

// ── API Response ─────────────────────────────────────────────
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  id?: string;
}
