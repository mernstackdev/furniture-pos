import Link from "next/link";
import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { InvoicesManager } from "@/components/InvoicesManager";
import { PaginationFooter } from "@/components/ui/ResponsiveList";
import { hasPermission, requirePermission } from "@/lib/auth";
import { mapSale, SALE_SELECT, type SaleRow } from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 10;
const STATUSES = ["paid", "unpaid"];

/** PostgREST `or` filters use commas and parentheses as delimiters. */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

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

  const supabase = createClient(await cookies());

  // Searching a customer by name would need an inner join in the filter; the
  // customer page covers per-customer history instead.
  let query = supabase.from("sales").select(SALE_SELECT, { count: "exact" });
  const term = sanitize(q);
  if (term) query = query.or(`invoice_no.ilike.%${term}%`);
  if (status !== "all") query = query.eq("status", status);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query
    .order("sold_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const sales: SaleRow[] = (data ?? []).map(mapSale);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

        <InvoicesManager sales={sales} canManage={hasPermission(user, "sales.manage")} />

        <PaginationFooter
          summary={total === 0 ? "No invoices" : `Showing ${from + 1}–${Math.min(from + PAGE_SIZE, total)} of ${total}`}
          page={page}
          totalPages={totalPages}
          prevHref={page > 1 ? hrefFor(page - 1) : null}
          nextHref={page < totalPages ? hrefFor(page + 1) : null}
        />
      </div>
    </div>
  );
}
