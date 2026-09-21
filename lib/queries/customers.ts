import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmptyRange } from "@/lib/queries/range";
import type { CustomerFilterValues } from "@/components/CustomerFilters";
import {
  CUSTOMER_SUMMARY_SELECT,
  mapCustomerSummary,
  mapSale,
  SALE_SELECT,
  type CustomerSummary,
  type SaleRow,
} from "@/lib/sales";

/**
 * Customer query definitions, shared by the server prefetch and the browser
 * cache.
 *
 * Each takes the Supabase client to use, so the same definition serves both
 * environments: the page passes the cookie-bound server client, the browser
 * passes the cookie-bound browser client. Keys must match exactly across the
 * two, or the hydrated data would sit under a key the component never reads.
 */

/** Everything a customer write can change, plus the invoices that embed them. */
export const CUSTOMERS_QUERY_KEY = ["customers"] as const;

/** Kept here rather than in lib/sales.ts so this domain owns its own paging. */
export const CUSTOMERS_PAGE_SIZE = 10;

/**
 * Search terms go into a PostgREST `or` filter, whose syntax uses commas and
 * parentheses as delimiters. Those characters (and the `*` wildcard alias and
 * `\`) are stripped so a term cannot break out of the filter expression.
 */
function sanitizeSearch(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export interface CustomersPageArgs {
  filters: CustomerFilterValues;
  page: number;
}

export interface CustomersPage {
  customers: CustomerSummary[];
  total: number;
}

export function customersQuery(
  supabase: SupabaseClient,
  { filters, page }: CustomersPageArgs
) {
  return {
    queryKey: ["customers", "list", filters, page] as const,
    queryFn: async (): Promise<CustomersPage> => {
      // The summary view carries the totals, so the list and the detail page
      // share one definition of "total spent" and "last payment method".
      let query = supabase
        .from("customer_summary")
        .select(CUSTOMER_SUMMARY_SELECT, { count: "exact" });

      const term = sanitizeSearch(filters.q);
      if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);

      const from = (page - 1) * CUSTOMERS_PAGE_SIZE;
      const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(from, from + CUSTOMERS_PAGE_SIZE - 1);

      if (error && !isEmptyRange(error)) throw error;

      return {
        customers: (data ?? []).map(mapCustomerSummary),
        total: count ?? 0,
      };
    },
  };
}

export function customerSummaryQuery(supabase: SupabaseClient, { id }: { id: string }) {
  return {
    queryKey: ["customers", "detail", id] as const,
    queryFn: async (): Promise<CustomerSummary | null> => {
      const { data, error } = await supabase
        .from("customer_summary")
        .select(CUSTOMER_SUMMARY_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      // A missing row is not an error — the page turns null into notFound().
      return data ? mapCustomerSummary(data) : null;
    },
  };
}

export function customerSalesQuery(
  supabase: SupabaseClient,
  { customerId }: { customerId: string }
) {
  return {
    queryKey: ["customers", "sales", customerId] as const,
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select(SALE_SELECT)
        .eq("customer_id", customerId)
        .order("sold_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map(mapSale);
    },
  };
}
