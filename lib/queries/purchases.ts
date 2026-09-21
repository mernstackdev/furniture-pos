import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmptyRange } from "@/lib/queries/range";
import type { PurchaseFilterValues } from "@/components/PurchaseFilters";
import {
  PRODUCT_SELECT,
  PURCHASE_SELECT,
  mapProduct,
  mapPurchaseOrder,
  type InventoryProduct,
  type PurchaseOrderRow,
} from "@/lib/inventory";

/**
 * Purchase query definitions, shared by the server prefetch and the browser
 * cache. Each takes the Supabase client to use, so one definition serves both
 * environments and the queryKey is identical in both.
 */

export const PURCHASES_PAGE_SIZE = 10;

export interface PurchaseOrdersPage {
  orders: PurchaseOrderRow[];
  total: number;
}

/** PostgREST `or` filters use commas and parentheses as delimiters. */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export function purchaseOrdersQuery(
  supabase: SupabaseClient,
  { filters, page }: { filters: PurchaseFilterValues; page: number }
) {
  return {
    queryKey: ["purchases", "orders", filters, page] as const,
    queryFn: async (): Promise<PurchaseOrdersPage> => {
      let query = supabase.from("purchase_orders").select(PURCHASE_SELECT, { count: "exact" });

      const term = sanitize(filters.q);
      // Searching a vendor by name would need an inner join in the filter; the
      // vendor dropdown covers that instead.
      if (term) query = query.or(`reference.ilike.%${term}%,notes.ilike.%${term}%`);
      if (filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.vendor !== "all") query = query.eq("vendor_id", filters.vendor);

      const from = (page - 1) * PURCHASES_PAGE_SIZE;

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + PURCHASES_PAGE_SIZE - 1);

      if (error && !isEmptyRange(error)) throw error;

      return {
        orders: (data ?? []).map(mapPurchaseOrder),
        total: count ?? 0,
      };
    },
  };
}

/**
 * The most recent orders across every vendor, for the payment form's "against
 * bill" picker. Not paged or filtered, so it is its own key rather than a page
 * slice of the list above.
 */
export function recentPurchaseOrdersQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["purchases", "recent-orders"] as const,
    queryFn: async (): Promise<PurchaseOrderRow[]> => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(PURCHASE_SELECT)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data ?? []).map(mapPurchaseOrder);
    },
  };
}

/** Every product, for the purchase order form's product picker. */
export function purchaseProductsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["purchases", "products"] as const,
    queryFn: async (): Promise<InventoryProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []).map(mapProduct);
    },
  };
}

/** Anything a purchase write can change: the order list and its pickers. */
export const PURCHASES_QUERY_KEY = ["purchases"] as const;
