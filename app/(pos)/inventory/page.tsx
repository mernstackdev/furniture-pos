import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { AddProductButton } from "@/components/AddProductButton";
import { InventoryManager } from "@/components/InventoryManager";
import type { InventoryFilterValues } from "@/components/InventoryFilters";
import { hasPermission, requirePermission } from "@/lib/auth";
import { INVENTORY_PAGE_SIZE } from "@/lib/inventory";
import {
  inventoryCategoriesQuery,
  inventoryProductsQuery,
} from "@/lib/queries/inventory";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

const STATUSES = ["out", "low", "ok"];

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const user = await requirePermission("inventory.view");
  const params = await props.searchParams;

  const read = (key: string) => {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return (value ?? "").trim();
  };

  const q = read("q");
  const category = read("category") || "all";
  const rawStatus = read("status") || "all";
  const status = STATUSES.includes(rawStatus) ? rawStatus : "all";
  const minPrice = read("minPrice");
  const maxPrice = read("maxPrice");
  const page = Math.max(1, Number(read("page")) || 1);

  const filters: InventoryFilterValues = {
    q,
    category,
    status,
    minPrice,
    maxPrice,
  };

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery rather than prefetchQuery: the offset count decides whether this
  // page number exists at all, and that redirect has to resolve before anything
  // streams. Both calls still fill the cache dehydrated below, so the browser
  // renders this data without issuing a query of its own.
  const [{ total }, categories] = await Promise.all([
    queryClient.fetchQuery(inventoryProductsQuery(supabase, { filters, page })),
    queryClient.fetchQuery(inventoryCategoriesQuery(supabase)),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));

  // Plain links, so paging works without client JS and keeps the filters.
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category !== "all") next.set("category", category);
    if (status !== "all") next.set("status", status);
    if (minPrice) next.set("minPrice", minPrice);
    if (maxPrice) next.set("maxPrice", maxPrice);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/inventory?${queryString}` : "/inventory";
  };

  // A page past the end (a stale bookmark, or a filter that shrank the result
  // set) would otherwise render an empty table under a "Page 3 of 1" footer.
  // Redirect to the last real page so the URL stays honest.
  if (page > totalPages) {
    redirect(hrefFor(totalPages));
  }

  return (
    <div>
      <TopBar
        title="Inventory Management"
        description="Manage your product catalog, pricing, and details"
        action={
          hasPermission(user, "inventory.manage") ? (
            <AddProductButton categories={categories} />
          ) : undefined
        }
      />
      <div className="p-4 sm:p-8">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <InventoryManager
            categories={categories}
            canManage={hasPermission(user, "inventory.manage")}
            filters={filters}
            page={page}
            pageSize={INVENTORY_PAGE_SIZE}
            prevHref={page > 1 ? hrefFor(page - 1) : null}
            nextHref={page < totalPages ? hrefFor(page + 1) : null}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
