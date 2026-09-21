import Link from "next/link";
import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { PurchasesManager } from "@/components/PurchasesManager";
import type { PurchaseFilterValues } from "@/components/PurchaseFilters";
import { hasPermission, requirePermission } from "@/lib/auth";
import { PURCHASES_PAGE_SIZE, purchaseOrdersQuery } from "@/lib/queries/purchases";
import { vendorOptionsQuery } from "@/lib/queries/vendors";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

const STATUSES = ["draft", "ordered", "received", "cancelled"];

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

  const filters: PurchaseFilterValues = { q, status, vendor };

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery because the count decides the next link, which has to resolve
  // before anything streams. The vendor picker fills the cache dehydrated below.
  const { total } = await queryClient.fetchQuery(
    purchaseOrdersQuery(supabase, { filters, page })
  );
  await queryClient.prefetchQuery(vendorOptionsQuery(supabase));

  const totalPages = Math.max(1, Math.ceil(total / PURCHASES_PAGE_SIZE));

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
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PurchasesManager
            canManage={canManage}
            filters={filters}
            page={page}
            pageSize={PURCHASES_PAGE_SIZE}
            prevHref={page > 1 ? hrefFor(page - 1) : null}
            nextHref={page < totalPages ? hrefFor(page + 1) : null}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
