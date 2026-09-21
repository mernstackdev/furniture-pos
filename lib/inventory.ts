// DB-facing inventory shapes.
//
// These are deliberately separate from lib/types.ts, which still describes the
// localStorage `Product` used by the sales flow. Two product shapes coexist
// until sales move to Postgres; keeping them in different modules makes the
// split visible instead of smeared across the code.

export type StockMovementType = "in" | "out" | "adjustment";

export type StockStatus = "out" | "low" | "ok";

export interface Category {
  id: string;
  name: string;
}

export interface InventoryProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  /** At or below this, the product shows up on the restock worklist. */
  reorderPoint: number;
  /** Computed by Postgres, so the badge and the status filter cannot disagree. */
  status: StockStatus;
  createdAt: string;
}

export interface StockMovementRow {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  qtyChange: number;
  reason: string;
  /** Who recorded it, and whether it came from receiving a purchase. */
  createdByName: string | null;
  purchaseOrderId: string | null;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
}

export type VendorPaymentMethod = "cash" | "bank" | "cheque" | "online";

export interface VendorPaymentRow {
  id: string;
  vendorId: string;
  vendorName: string;
  purchaseOrderId: string | null;
  amount: number;
  method: VendorPaymentMethod;
  reference: string;
  note: string;
  paidAt: string;
}

/** From the vendor_balances view: purchases received less payments made. */
export interface VendorBalance {
  vendorId: string;
  purchasedTotal: number;
  paidTotal: number;
  outstanding: number;
}

export const VENDOR_PAYMENT_SELECT =
  "id, vendor_id, purchase_order_id, amount, method, reference, note, paid_at, vendors(name)";

export const vendorPaymentMethodLabel: Record<VendorPaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  cheque: "Cheque",
  online: "Online",
};

export function mapVendorPayment(row: {
  id: string;
  vendor_id: string;
  purchase_order_id: string | null;
  amount: number | string;
  method: VendorPaymentMethod;
  reference: string;
  note: string;
  paid_at: string;
  vendors?: { name?: string } | { name?: string }[] | null;
}): VendorPaymentRow {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: firstEmbedded(row.vendors)?.name ?? "Unknown vendor",
    purchaseOrderId: row.purchase_order_id,
    amount: Number(row.amount),
    method: row.method,
    reference: row.reference,
    note: row.note,
    paidAt: row.paid_at,
  };
}

export type PurchaseStatus = "draft" | "ordered" | "received" | "cancelled";

export interface PurchaseOrderRow {
  id: string;
  vendorId: string;
  vendorName: string;
  reference: string;
  status: PurchaseStatus;
  notes: string;
  itemCount: number;
  totalCost: number;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export const MOVEMENT_SELECT =
  "id, product_id, movement_type, qty_change, reason, purchase_order_id, created_at, products(name), profiles(full_name)";

/**
 * The purchase RPC's p_items reads snake_case keys, while the form works in
 * camelCase. Converting here keeps the database contract snake_case and makes
 * the translation a single, testable place: passing the form's objects straight
 * through silently produced a NULL product_id and a zeroed unit cost.
 */
export function toPurchaseItemsPayload(
  items: { productId: string; qty: number; unitCost: number }[]
): { product_id: string; qty: number; unit_cost: number }[] {
  return items.map((item) => ({
    product_id: item.productId,
    qty: item.qty,
    unit_cost: item.unitCost,
  }));
}

export const PURCHASE_SELECT =
  "id, vendor_id, reference, status, notes, ordered_at, received_at, created_at, vendors(name), purchase_order_items(qty_ordered, unit_cost)";

/** PostgREST returns a to-one embed as an object, but an array in some shapes. */
function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

export function mapMovement(row: {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  qty_change: number;
  reason: string;
  purchase_order_id: string | null;
  created_at: string;
  products?: { name?: string } | { name?: string }[] | null;
  profiles?: { full_name?: string } | { full_name?: string }[] | null;
}): StockMovementRow {
  return {
    id: row.id,
    productId: row.product_id,
    productName: firstEmbedded(row.products)?.name ?? "Deleted product",
    type: row.movement_type,
    qtyChange: row.qty_change,
    reason: row.reason,
    createdByName: firstEmbedded(row.profiles)?.full_name || null,
    purchaseOrderId: row.purchase_order_id,
    createdAt: row.created_at,
  };
}

export function mapPurchaseOrder(row: {
  id: string;
  vendor_id: string;
  reference: string;
  status: PurchaseStatus;
  notes: string;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  vendors?: { name?: string } | { name?: string }[] | null;
  purchase_order_items?: { qty_ordered: number; unit_cost: number | string }[] | null;
}): PurchaseOrderRow {
  const lines = row.purchase_order_items ?? [];
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: firstEmbedded(row.vendors)?.name ?? "Unknown vendor",
    reference: row.reference,
    status: row.status,
    notes: row.notes,
    itemCount: lines.length,
    totalCost: lines.reduce(
      (sum, line) => sum + line.qty_ordered * Number(line.unit_cost),
      0
    ),
    orderedAt: row.ordered_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}

export const purchaseStatusTone: Record<
  PurchaseStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral",
  ordered: "warning",
  received: "success",
  cancelled: "danger",
};

/** Columns every inventory read needs, including the embedded category name. */
export const PRODUCT_SELECT =
  "id, category_id, name, sku, unit, cost_price, sell_price, stock_qty, low_stock_threshold, reorder_point, stock_status, created_at, categories(name)";

interface RawProduct {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  unit: string;
  cost_price: number | string;
  sell_price: number | string;
  stock_qty: number;
  low_stock_threshold: number;
  reorder_point: number;
  stock_status: StockStatus;
  created_at: string;
  categories?: { name?: string } | { name?: string }[] | null;
}

function embeddedCategoryName(embedded: RawProduct["categories"]): string {
  if (Array.isArray(embedded)) return embedded[0]?.name ?? "Uncategorised";
  return embedded?.name ?? "Uncategorised";
}

export function mapProduct(row: RawProduct): InventoryProduct {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: embeddedCategoryName(row.categories),
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    // numeric columns can arrive as strings depending on serialisation.
    costPrice: Number(row.cost_price),
    sellPrice: Number(row.sell_price),
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    reorderPoint: row.reorder_point,
    status: row.stock_status,
    createdAt: row.created_at,
  };
}

export const stockStatusLabel: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Low stock",
  ok: "In stock",
};

export const stockStatusTone: Record<StockStatus, "danger" | "warning" | "success"> = {
  out: "danger",
  low: "warning",
  ok: "success",
};

export const movementTone: Record<StockMovementType, "success" | "danger" | "neutral"> = {
  in: "success",
  out: "danger",
  adjustment: "neutral",
};

export const INVENTORY_PAGE_SIZE = 10;
