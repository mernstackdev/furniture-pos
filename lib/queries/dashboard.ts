import type { SupabaseClient } from "@supabase/supabase-js";
import { mapProduct, PRODUCT_SELECT, type InventoryProduct } from "@/lib/inventory";
import { mapSale, SALE_SELECT, type SaleRow } from "@/lib/sales";

/**
 * Dashboard queries, shared by the server prefetch and the browser cache.
 *
 * Every read here is a one-off aggregate rather than a page of rows, so these
 * do not reuse the paged inventory factory: the customer count is a head-only
 * request and the day's revenue is summed inside the queryFn, so the cache
 * holds the number the page displays instead of rows it would only reduce
 * again. The keys must match exactly across both callers or the dehydrated
 * data would sit under a key the component never reads.
 */

/** The start of the current local day, as the instant the `sold_at` filter wants. */
function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export function dashboardProductsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["dashboard", "products"] as const,
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

export function dashboardCustomerCountQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["dashboard", "customer-count"] as const,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      return count ?? 0;
    },
  };
}

export interface DashboardTodaySales {
  /** SUM(sales.total) since local midnight. */
  revenue: number;
  /** The count of today's invoices. */
  count: number;
}

export function dashboardTodaySalesQuery(supabase: SupabaseClient) {
  // The day boundary is evaluated when the queryFn runs rather than baked into
  // the key. A `new Date()`-derived key would differ between the server render
  // and the browser hydrate (different clock, often a different timezone), and
  // hydration would then silently do nothing. The 30s stale window still rolls
  // the figure over promptly.
  return {
    queryKey: ["dashboard", "today-sales"] as const,
    queryFn: async (): Promise<DashboardTodaySales> => {
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .gte("sold_at", startOfToday().toISOString());

      if (error) throw error;

      const rows = data ?? [];
      return {
        revenue: rows.reduce((sum, row) => sum + Number(row.total), 0),
        count: rows.length,
      };
    },
  };
}

export function dashboardRecentSalesQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["dashboard", "recent-sales"] as const,
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select(SALE_SELECT)
        .order("sold_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data ?? []).map(mapSale);
    },
  };
}

/** Root key for everything the dashboard reads. */
export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;
