import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapMovement,
  mapProduct,
  MOVEMENT_SELECT,
  PRODUCT_SELECT,
  type InventoryProduct,
  type StockMovementRow,
} from "@/lib/inventory";

/**
 * Stock-screen queries: current levels and the recent movement ledger.
 *
 * Taken by the Supabase client so the same definition serves the server
 * prefetch and the browser cache. The keys must match exactly across the two or
 * the dehydrated data would sit under a key the component never reads.
 */

const MOVEMENT_HISTORY_LIMIT = 100;

export function stockProductsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["stock", "products"] as const,
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

export function stockMovementsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["stock", "movements"] as const,
    queryFn: async (): Promise<StockMovementRow[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(MOVEMENT_SELECT)
        .order("created_at", { ascending: false })
        .limit(MOVEMENT_HISTORY_LIMIT);

      if (error) throw error;

      return (data ?? []).map(mapMovement);
    },
  };
}

/** Root key for the stock screen. A stock write also changes inventory. */
export const STOCK_QUERY_KEY = ["stock"] as const;
