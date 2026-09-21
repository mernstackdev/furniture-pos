import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmptyRange } from "@/lib/queries/range";
import type { InventoryFilterValues } from "@/components/InventoryFilters";
import {
  INVENTORY_PAGE_SIZE,
  mapProduct,
  PRODUCT_SELECT,
  type Category,
  type InventoryProduct,
} from "@/lib/inventory";

/**
 * Inventory query definitions, shared by the server prefetch and the browser
 * cache.
 *
 * Each takes the Supabase client to use, so the same definition serves both
 * environments: the page passes the cookie-bound server client, the browser
 * passes the cookie-bound browser client. Only the browser one ever runs as a
 * "fetch" — on the server it fills the cache that gets dehydrated.
 *
 * Keys must match exactly across the two, or the hydrated data would sit under
 * a key the component never reads.
 */

export interface InventoryPageArgs {
  filters: InventoryFilterValues;
  page: number;
}

export interface InventoryProductsPage {
  products: InventoryProduct[];
  total: number;
}

/**
 * Search terms go into a PostgREST `or` filter, whose syntax uses commas and
 * parentheses as delimiters. Those characters (and the `*` wildcard alias and
 * `\`) are stripped so a term cannot break out of the filter expression.
 */
function sanitizeSearch(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export function inventoryProductsQuery(
  supabase: SupabaseClient,
  { filters, page }: InventoryPageArgs
) {
  return {
    queryKey: ["inventory", "products", filters, page] as const,
    queryFn: async (): Promise<InventoryProductsPage> => {
      let query = supabase.from("products").select(PRODUCT_SELECT, { count: "exact" });

      const term = sanitizeSearch(filters.q);
      if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
      if (filters.category !== "all") query = query.eq("category_id", filters.category);
      if (filters.status !== "all") query = query.eq("stock_status", filters.status);
      if (filters.minPrice) query = query.gte("sell_price", Number(filters.minPrice));
      if (filters.maxPrice) query = query.lte("sell_price", Number(filters.maxPrice));

      const from = (page - 1) * INVENTORY_PAGE_SIZE;
      const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(from, from + INVENTORY_PAGE_SIZE - 1);

      if (error && !isEmptyRange(error)) throw error;

      return {
        products: (data ?? []).map(mapProduct),
        total: count ?? 0,
      };
    },
  };
}

export function inventoryCategoriesQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["inventory", "categories"] as const,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
      }));
    },
  };
}

/** Everything a product write can change, so one call refreshes the screen. */
export const INVENTORY_QUERY_KEY = ["inventory"] as const;
