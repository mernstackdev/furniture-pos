export type ProductCategory =
  | "Sofas"
  | "Beds"
  | "Dining"
  | "Wardrobes"
  | "Chairs"
  | "Tables"
  | "Decor";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export type PaymentMethod = "cash" | "card" | "bank";
export type SaleStatus = "paid" | "unpaid";

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string | null;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
}

export type StockMovementType = "in" | "out" | "adjustment";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  qty: number;
  reason: string;
  date: string;
}

export type DiscountType = "percentage" | "amount";

export interface ShopSettings {
  shopName: string;
  shopTagline: string;
  discountType: DiscountType;
}

export interface AppData {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  stockMovements: StockMovement[];
  settings: ShopSettings;
}
