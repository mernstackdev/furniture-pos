import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { AddVendorButton } from "@/components/AddVendorButton";
import { VendorsManager } from "@/components/VendorsManager";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  mapPurchaseOrder,
  mapVendorPayment,
  PURCHASE_SELECT,
  VENDOR_PAYMENT_SELECT,
  type PurchaseOrderRow,
  type Vendor,
  type VendorBalance,
} from "@/lib/inventory";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 10;
const BALANCES = ["all", "owing", "settled"];

/** PostgREST `or` filters use commas and parentheses as delimiters. */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export default async function VendorsPage(props: PageProps<"/vendors">) {
  const user = await requirePermission("inventory.view");
  const params = await props.searchParams;

  const read = (key: string) => {
    const raw = params[key];
    return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  };

  const q = read("q");
  const rawBalance = read("balance") || "all";
  const balance = BALANCES.includes(rawBalance) ? rawBalance : "all";
  const page = Math.max(1, Number(read("page")) || 1);

  const supabase = createClient(await cookies());

  // Balances live in a view, so searching and paging happen against it; the
  // vendor contact fields are then fetched for just this page.
  let query = supabase
    .from("vendor_balances")
    .select("vendor_id, vendor_name, phone, city, purchased_total, paid_total, outstanding", {
      count: "exact",
    });

  const term = sanitize(q);
  if (term) {
    query = query.or(
      `vendor_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`
    );
  }
  if (balance === "owing") query = query.gt("outstanding", 0);
  if (balance === "settled") query = query.eq("outstanding", 0);

  const from = (page - 1) * PAGE_SIZE;

  const { data: balanceRows, count } = await query
    .order("vendor_name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const ids = (balanceRows ?? []).map((row) => row.vendor_id as string);

  const [{ data: vendorRows }, { data: paymentRows }, { data: orderRows }] = await Promise.all([
    ids.length
      ? supabase.from("vendors").select("id, name, phone, city, address, notes").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase
      .from("vendor_payments")
      .select(VENDOR_PAYMENT_SELECT)
      .order("paid_at", { ascending: false })
      .limit(200),
    supabase
      .from("purchase_orders")
      .select(PURCHASE_SELECT)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const vendorById = new Map((vendorRows ?? []).map((row) => [row.id as string, row]));

  const vendors: Vendor[] = (balanceRows ?? []).map((row) => {
    const id = row.vendor_id as string;
    const full = vendorById.get(id);
    return {
      id,
      name: (full?.name as string) ?? (row.vendor_name as string),
      phone: (full?.phone as string) ?? (row.phone as string),
      city: (full?.city as string) ?? (row.city as string),
      address: (full?.address as string) ?? "",
      notes: (full?.notes as string) ?? "",
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

  const payments = (paymentRows ?? []).map(mapVendorPayment);
  const orders: PurchaseOrderRow[] = (orderRows ?? []).map(mapPurchaseOrder);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (balance !== "all") next.set("balance", balance);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/vendors?${queryString}` : "/vendors";
  };

  return (
    <div>
      <TopBar
        title="Vendors"
        description="Who you buy from, and what you still owe them"
        action={hasPermission(user, "inventory.manage") ? <AddVendorButton /> : undefined}
      />
      <div className="p-4 sm:p-8">
        <VendorsManager
          vendors={vendors}
          balances={balances}
          payments={payments}
          orders={orders}
          canManage={hasPermission(user, "inventory.manage")}
          filters={{ q, balance }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          prevHref={page > 1 ? hrefFor(page - 1) : null}
          nextHref={page < totalPages ? hrefFor(page + 1) : null}
        />
      </div>
    </div>
  );
}
