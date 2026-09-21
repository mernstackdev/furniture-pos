import Link from "next/link";
import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { InvoicesManager } from "@/components/InvoicesManager";
import { PaginationFooter } from "@/components/ui/ResponsiveList";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  INVOICES_PAGE_SIZE,
  invoicesQuery,
  type InvoiceFilterValues,
} from "@/lib/queries/invoices";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

const STATUSES = ["paid", "unpaid"];

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const user = await requirePermission("sales.view");
  const params = await props.searchParams;

  const read = (key: string) => {
    const raw = params[key];
    return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  };

  const q = read("q");
  const rawStatus = read("status") || "all";
  const status = STATUSES.includes(rawStatus) ? rawStatus : "all";
  const page = Math.max(1, Number(read("page")) || 1);

  const filters: InvoiceFilterValues = { q, status };

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // The footer needs the total, so it is fetched rather than prefetched; the
  // same call still fills the cache dehydrated below.
  const { total } = await queryClient.fetchQuery(invoicesQuery(supabase, { filters, page }));

  const totalPages = Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE));
  const from = (page - 1) * INVOICES_PAGE_SIZE;

  // Plain links, so paging works without client JS and keeps the filters.
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/invoices?${queryString}` : "/invoices";
  };

  const statusHref = (value: string) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (value !== "all") next.set("status", value);
    const queryString = next.toString();
    return queryString ? `/invoices?${queryString}` : "/invoices";
  };

  return (
    <div>
      <TopBar title="Invoices" description="Every sale recorded at the till" />
      <div className="space-y-4 p-4 sm:p-8">
        {/* A plain GET form, so searching needs no client component. */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <form action="/invoices" method="get" className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 text-sm sm:max-w-xs">
              <span className="mb-1 block font-medium text-foreground">Search</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Invoice number"
                className="input"
              />
            </label>
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
            >
              Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {["all", "paid", "unpaid"].map((value) => (
              <Link
                key={value}
                href={statusHref(value)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                  status === value
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-foreground hover:bg-surface-muted"
                }`}
              >
                {value === "all" ? "All" : value}
              </Link>
            ))}
          </div>
        </div>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <InvoicesManager
            canManage={hasPermission(user, "sales.manage")}
            filters={filters}
            page={page}
          />
        </HydrationBoundary>

        <PaginationFooter
          summary={total === 0 ? "No invoices" : `Showing ${from + 1}–${Math.min(from + INVOICES_PAGE_SIZE, total)} of ${total}`}
          page={page}
          totalPages={totalPages}
          prevHref={page > 1 ? hrefFor(page - 1) : null}
          nextHref={page < totalPages ? hrefFor(page + 1) : null}
        />
      </div>
    </div>
  );
}
