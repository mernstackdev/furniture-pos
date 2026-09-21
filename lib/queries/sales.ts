import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapProduct,
  PRODUCT_SELECT,
  type Category,
  type InventoryProduct,
} from "@/lib/inventory";
import { CUSTOMER_SELECT, mapCustomer, type Customer } from "@/lib/sales";

/**
 * Sales/POS query definitions, shared by the server prefetch and the browser
 * cache.
 *
 * Each takes the Supabase client to use, so the same definition serves both
 * environments: the page passes the cookie-bound server client, the till passes
 * the browser one. Only the browser one ever runs as a "fetch" — on the server
 * it fills the cache that gets dehydrated. The `queryKey` must be identical on
 * both sides or hydration silently does nothing.
 *
 * The till needs the *whole* catalogue and customer list, while the inventory
 * screen reads a filtered, paged slice — a different query, so a different
 * factory rather than a reuse of `inventoryProductsQuery`.
 */

/**
 * The customers list lives under the sales root so invalidating one key (see
 * `SALES_QUERY_KEY`) refreshes everything the till reads.
 */
export const SALES_CUSTOMERS_KEY = ["sales", "customers"] as const;

/** Everything the sales screen reads; invalidating this refreshes the till. */
export const SALES_QUERY_KEY = ["sales"] as const;

export function salesProductsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["sales", "products"] as const,
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

export function salesCustomersQuery(supabase: SupabaseClient) {
  return {
    queryKey: SALES_CUSTOMERS_KEY,
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select(CUSTOMER_SELECT)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []).map(mapCustomer);
    },
  };
}

export function salesCategoriesQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["sales", "categories"] as const,
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
