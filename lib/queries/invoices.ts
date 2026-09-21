import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmptyRange } from "@/lib/queries/range";
import {
  mapSale,
  mapSaleItem,
  SALE_ITEM_SELECT,
  SALE_SELECT,
  type SaleItemRow,
  type SaleRow,
} from "@/lib/sales";

/**
 * Invoice query definitions, shared by the server prefetch and the browser
 * cache.
 *
 * Each takes the Supabase client to use, so the same definition serves both
 * environments: the page passes the cookie-bound server client, the browser
 * passes the cookie-bound browser client. Keys must match exactly across the
 * two, or the hydrated data would sit under a key the component never reads.
 */

/** Everything an invoice write can change. */
export const INVOICES_QUERY_KEY = ["invoices"] as const;

/** Kept here rather than in lib/sales.ts so this domain owns its own paging. */
export const INVOICES_PAGE_SIZE = 10;

export interface InvoiceFilterValues {
  q: string;
  status: string;
}

/**
 * Search terms go into a PostgREST `or` filter, whose syntax uses commas and
 * parentheses as delimiters. Those characters (and the `*` wildcard alias and
 * `\`) are stripped so a term cannot break out of the filter expression.
 */
function sanitizeSearch(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export interface InvoicesPageArgs {
  filters: InvoiceFilterValues;
  page: number;
}

export interface InvoicesPage {
  sales: SaleRow[];
  total: number;
}

export function invoicesQuery(
  supabase: SupabaseClient,
  { filters, page }: InvoicesPageArgs
) {
  return {
    queryKey: ["invoices", "list", filters, page] as const,
    queryFn: async (): Promise<InvoicesPage> => {
      // Searching a customer by name would need an inner join in the filter;
      // the customer page covers per-customer history instead.
      let query = supabase.from("sales").select(SALE_SELECT, { count: "exact" });

      const term = sanitizeSearch(filters.q);
      if (term) query = query.or(`invoice_no.ilike.%${term}%`);
      if (filters.status !== "all") query = query.eq("status", filters.status);

      const from = (page - 1) * INVOICES_PAGE_SIZE;
      const { data, count, error } = await query
        .order("sold_at", { ascending: false })
        .range(from, from + INVOICES_PAGE_SIZE - 1);

      if (error && !isEmptyRange(error)) throw error;

      return {
        sales: (data ?? []).map(mapSale),
        total: count ?? 0,
      };
    },
  };
}

export function invoiceQuery(supabase: SupabaseClient, { id }: { id: string }) {
  return {
    queryKey: ["invoices", "detail", id] as const,
    queryFn: async (): Promise<SaleRow | null> => {
      const { data, error } = await supabase
        .from("sales")
        .select(SALE_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      // A missing row is not an error — the page turns null into notFound().
      return data ? mapSale(data) : null;
    },
  };
}

export function invoiceItemsQuery(supabase: SupabaseClient, { id }: { id: string }) {
  return {
    queryKey: ["invoices", "items", id] as const,
    queryFn: async (): Promise<SaleItemRow[]> => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(SALE_ITEM_SELECT)
        .eq("sale_id", id);

      if (error) throw error;

      return (data ?? []).map(mapSaleItem);
    },
  };
}

/** The billing contact for an invoice, keyed by the sale's customer id. */
export function invoiceCustomerQuery(
  supabase: SupabaseClient,
  { customerId }: { customerId: string }
) {
  return {
    queryKey: ["invoices", "customer", customerId] as const,
    queryFn: async (): Promise<{ phone: string; address: string } | null> => {
      const { data, error } = await supabase
        .from("customers")
        .select("phone, address")
        .eq("id", customerId)
        .maybeSingle();

      if (error) throw error;

      return data ?? null;
    },
  };
}
