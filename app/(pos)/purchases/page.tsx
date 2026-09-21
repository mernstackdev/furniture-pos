import Link from "next/link";
import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { PurchasesManager } from "@/components/PurchasesManager";
import type { VendorOption } from "@/components/PurchaseFilters";
import { hasPermission, requirePermission } from "@/lib/auth";
import { mapPurchaseOrder, PURCHASE_SELECT, type PurchaseOrderRow } from "@/lib/inventory";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 10;
const STATUSES = ["draft", "ordered", "received", "cancelled"];

/** PostgREST `or` filters use commas and parentheses as delimiters. */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export default async function PurchasesPage(props: PageProps<"/purchases">) {
  const user = await requirePermission("inventory.view");
  const params = await props.searchParams;

  const read = (key: string) => {
    const raw = params[key];
    return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  };

  const q = read("q");
  const rawStatus = read("status") || "all";
  const status = STATUSES.includes(rawStatus) ? rawStatus : "all";
  const vendor = read("vendor") || "all";
  const page = Math.max(1, Number(read("page")) || 1);
  const canManage = hasPermission(user, "inventory.manage");

  const supabase = createClient(await cookies());

  let query = supabase.from("purchase_orders").select(PURCHASE_SELECT, { count: "exact" });

  const term = sanitize(q);
  // Searching a vendor by name would need an inner join in the filter; the
  // vendor dropdown covers that instead.
  if (term) query = query.or(`reference.ilike.%${term}%,notes.ilike.%${term}%`);
  if (status !== "all") query = query.eq("status", status);
  if (vendor !== "all") query = query.eq("vendor_id", vendor);

  const from = (page - 1) * PAGE_SIZE;

  const [{ data: orderRows, count }, { data: vendorRows }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("vendors").select("id, name").order("name"),
  ]);

  const orders: PurchaseOrderRow[] = (orderRows ?? []).map(mapPurchaseOrder);
  const vendors: VendorOption[] = (vendorRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (vendor !== "all") next.set("vendor", vendor);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/purchases?${queryString}` : "/purchases";
  };

  return (
    <div>
      <TopBar
        title="Purchases"
        description="Order stock from vendors and receive it into inventory"
        action={
          canManage ? (
            <Link
              href="/purchases/new"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-95"
            >
              + New<span className="hidden sm:inline"> purchase order</span>
            </Link>
          ) : undefined
        }
      />
      <div className="p-4 sm:p-8">
        <PurchasesManager
          orders={orders}
          vendors={vendors}
          canManage={canManage}
          filters={{ q, status, vendor }}
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
