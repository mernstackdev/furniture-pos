// DB-facing sales shapes, mirroring lib/inventory.ts.

export type PaymentMethod = "cash" | "card" | "bank";
export type SaleStatus = "paid" | "unpaid";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

/** From the customer_summary view. */
export interface CustomerSummary extends Customer {
  orderCount: number;
  totalSpent: number;
  outstanding: number;
  lastOrderAt: string | null;
  lastPaymentMethod: PaymentMethod | null;
}

export interface SaleRow {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  soldAt: string;
  itemCount: number;
}

export interface SaleItemRow {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export const CUSTOMER_SELECT = "id, name, phone, address, created_at";

export const CUSTOMER_SUMMARY_SELECT =
  "id, name, phone, address, created_at, order_count, total_spent, outstanding, last_order_at, last_payment_method";

export const SALE_SELECT =
  "id, invoice_no, customer_id, subtotal, discount, total, payment_method, status, sold_at, customers(name), sale_items(qty)";

export const SALE_ITEM_SELECT = "id, product_id, name, qty, unit_price, line_total";

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank: "Bank transfer",
};

/** PostgREST returns a to-one embed as an object, but an array in some shapes. */
function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

export function mapCustomer(row: {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    createdAt: row.created_at,
  };
}

export function mapCustomerSummary(row: {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  order_count: number;
  total_spent: number | string;
  outstanding: number | string;
  last_order_at: string | null;
  last_payment_method: PaymentMethod | null;
}): CustomerSummary {
  return {
    ...mapCustomer(row),
    orderCount: Number(row.order_count),
    totalSpent: Number(row.total_spent),
    outstanding: Number(row.outstanding),
    lastOrderAt: row.last_order_at,
    lastPaymentMethod: row.last_payment_method,
  };
}

export function mapSale(row: {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  payment_method: PaymentMethod;
  status: SaleStatus;
  sold_at: string;
  customers?: { name?: string } | { name?: string }[] | null;
  sale_items?: { qty: number }[] | null;
}): SaleRow {
  const items = row.sale_items ?? [];
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id,
    customerName: firstEmbedded(row.customers)?.name ?? "Walk-in customer",
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    status: row.status,
    soldAt: row.sold_at,
    itemCount: items.reduce((count, item) => count + item.qty, 0),
  };
}

export function mapSaleItem(row: {
  id: string;
  product_id: string | null;
  name: string;
  qty: number;
  unit_price: number | string;
  line_total: number | string;
}): SaleItemRow {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    qty: row.qty,
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

export const saleStatusTone: Record<SaleStatus, "success" | "warning"> = {
  paid: "success",
  unpaid: "warning",
};
