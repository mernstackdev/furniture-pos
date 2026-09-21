import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { AddVendorButton } from "@/components/AddVendorButton";
import { VendorsManager } from "@/components/VendorsManager";
import type { VendorFilterValues } from "@/components/VendorFilters";
import { hasPermission, requirePermission } from "@/lib/auth";
import { recentPurchaseOrdersQuery } from "@/lib/queries/purchases";
import {
  VENDORS_PAGE_SIZE,
  vendorPaymentsQuery,
  vendorsQuery,
} from "@/lib/queries/vendors";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

const BALANCES = ["all", "owing", "settled"];

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

  const filters: VendorFilterValues = { q, balance };

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery rather than prefetchQuery: the offset count decides whether this
  // page number exists at all, and that redirect has to resolve before anything
  // streams. The other reads fill the cache dehydrated below.
  const { total } = await queryClient.fetchQuery(vendorsQuery(supabase, { filters, page }));
  await Promise.all([
    queryClient.prefetchQuery(vendorPaymentsQuery(supabase)),
    queryClient.prefetchQuery(recentPurchaseOrdersQuery(supabase)),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE));

  // Plain links, so paging works without client JS and keeps the filters.
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (balance !== "all") next.set("balance", balance);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/vendors?${queryString}` : "/vendors";
  };

  // A page past the end (a stale bookmark, or a filter that shrank the result
  // set) would otherwise render an empty table under a "Page 3 of 1" footer.
  if (page > totalPages) {
    redirect(hrefFor(totalPages));
  }

  return (
    <div>
      <TopBar
        title="Vendors"
        description="Who you buy from, and what you still owe them"
        action={hasPermission(user, "inventory.manage") ? <AddVendorButton /> : undefined}
      />
      <div className="p-4 sm:p-8">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <VendorsManager
            canManage={hasPermission(user, "inventory.manage")}
            filters={filters}
            page={page}
            pageSize={VENDORS_PAGE_SIZE}
            prevHref={page > 1 ? hrefFor(page - 1) : null}
            nextHref={page < totalPages ? hrefFor(page + 1) : null}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
