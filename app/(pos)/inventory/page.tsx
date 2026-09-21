import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { AddProductButton } from "@/components/AddProductButton";
import { InventoryManager } from "@/components/InventoryManager";
import type { InventoryFilterValues } from "@/components/InventoryFilters";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  INVENTORY_PAGE_SIZE,
  mapProduct,
  PRODUCT_SELECT,
  type Category,
} from "@/lib/inventory";
import { createClient } from "@/utils/supabase/server";

const STATUSES = ["out", "low", "ok"];

/**
 * Search terms go into a PostgREST `or` filter, whose syntax uses commas and
 * parentheses as delimiters. Those characters (and the `*` wildcard alias and
 * `\`) are stripped so a term cannot break out of the filter expression.
 */
function sanitizeSearch(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

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

  let query = supabase.from("products").select(PRODUCT_SELECT, { count: "exact" });

  const term = sanitizeSearch(q);
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  if (category !== "all") query = query.eq("category_id", category);
  if (status !== "all") query = query.eq("stock_status", status);
  if (minPrice) query = query.gte("sell_price", Number(minPrice));
  if (maxPrice) query = query.lte("sell_price", Number(maxPrice));

  const from = (page - 1) * INVENTORY_PAGE_SIZE;

  const [{ data, count }, { data: categoryRows }] = await Promise.all([
    query.order("name", { ascending: true }).range(from, from + INVENTORY_PAGE_SIZE - 1),
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
  ]);

  const products = (data ?? []).map(mapProduct);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));

  const categories: Category[] = (categoryRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));

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
        <InventoryManager
          products={products}
          categories={categories}
          canManage={hasPermission(user, "inventory.manage")}
          filters={filters}
          page={page}
          pageSize={INVENTORY_PAGE_SIZE}
          total={total}
          prevHref={page > 1 ? hrefFor(page - 1) : null}
          nextHref={page < totalPages ? hrefFor(page + 1) : null}
        />
      </div>
    </div>
  );
}
