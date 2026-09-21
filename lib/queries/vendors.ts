import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmptyRange } from "@/lib/queries/range";
import type { VendorFilterValues } from "@/components/VendorFilters";
import {
  VENDOR_PAYMENT_SELECT,
  mapVendorPayment,
  type Vendor,
  type VendorBalance,
  type VendorPaymentRow,
} from "@/lib/inventory";

/**
 * Vendor query definitions, shared by the server prefetch and the browser
 * cache. Each takes the Supabase client to use, so one definition serves both
 * environments and the queryKey is identical in both.
 */

export const VENDORS_PAGE_SIZE = 10;

export interface VendorsPage {
  vendors: Vendor[];
  balances: Record<string, VendorBalance>;
  total: number;
}

/**
 * Search terms go into a PostgREST `or` filter, whose syntax uses commas and
 * parentheses as delimiters. Those characters (and the `*` wildcard alias and
 * `\`) are stripped so a term cannot break out of the filter expression.
 */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export function vendorsQuery(
  supabase: SupabaseClient,
  { filters, page }: { filters: VendorFilterValues; page: number }
) {
  return {
    queryKey: ["vendors", "list", filters, page] as const,
    queryFn: async (): Promise<VendorsPage> => {
      // Balances live in a view, so searching and paging happen against it.
      let query = supabase
        .from("vendor_balances")
        .select("vendor_id, vendor_name, phone, city, purchased_total, paid_total, outstanding", {
          count: "exact",
        });

      const term = sanitize(filters.q);
      if (term) {
        query = query.or(
          `vendor_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`
        );
      }
      if (filters.balance === "owing") query = query.gt("outstanding", 0);
      if (filters.balance === "settled") query = query.eq("outstanding", 0);

      const from = (page - 1) * VENDORS_PAGE_SIZE;

      const { data: balanceRows, count, error } = await query
        .order("vendor_name", { ascending: true })
        .range(from, from + VENDORS_PAGE_SIZE - 1);

      if (error && !isEmptyRange(error)) throw error;

      const ids = (balanceRows ?? []).map((row) => row.vendor_id as string);

      // The full contact fields live on the base table, so they are fetched for
      // just this page. This is awaited after the balance read because the ids
      // come from it.
      const vendorById = new Map<
        string,
        { name?: string; phone?: string; city?: string; address?: string; notes?: string }
      >();
      if (ids.length) {
        const { data: vendorRows, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, phone, city, address, notes")
          .in("id", ids);

        if (vendorError) throw vendorError;

        for (const row of vendorRows ?? []) {
          vendorById.set(row.id as string, row);
        }
      }

      const vendors: Vendor[] = (balanceRows ?? []).map((row) => {
        const id = row.vendor_id as string;
        const full = vendorById.get(id);
        return {
          id,
          name: full?.name ?? (row.vendor_name as string),
          phone: full?.phone ?? (row.phone as string),
          city: full?.city ?? (row.city as string),
          address: full?.address ?? "",
          notes: full?.notes ?? "",
        };
      });

      const balances: Record<string, VendorBalance> = {};
      for (const row of balanceRows ?? []) {
        balances[row.vendor_id as string] = {
          vendorId: row.vendor_id as string,
          purchasedTotal: Number(row.purchased_total),
          paidTotal: Number(row.paid_total),
          outstanding: Number(row.outstanding),
        };
      }

      return { vendors, balances, total: count ?? 0 };
    },
  };
}

export function vendorPaymentsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["vendors", "payments"] as const,
    queryFn: async (): Promise<VendorPaymentRow[]> => {
      const { data, error } = await supabase
        .from("vendor_payments")
        .select(VENDOR_PAYMENT_SELECT)
        .order("paid_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data ?? []).map(mapVendorPayment);
    },
  };
}

/**
 * Every vendor, for pickers that need the full contact record. Kept under the
 * vendors root so a vendor write refreshes the purchase pickers too.
 */
export function vendorOptionsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["vendors", "options"] as const,
    queryFn: async (): Promise<Vendor[]> => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, phone, city, address, notes")
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        phone: row.phone as string,
        city: row.city as string,
        address: row.address as string,
        notes: row.notes as string,
      }));
    },
  };
}

/** Anything a vendor write can change: the list, the balances and the pickers. */
export const VENDORS_QUERY_KEY = ["vendors"] as const;
