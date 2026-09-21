import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { AddCustomerButton } from "@/components/AddCustomerButton";
import { CustomersManager } from "@/components/CustomersManager";
import { hasPermission, requirePermission } from "@/lib/auth";
import { CUSTOMER_SUMMARY_SELECT, mapCustomerSummary } from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 10;

/** PostgREST `or` filters use commas and parentheses as delimiters. */
function sanitize(term: string): string {
  return term.replace(/[,()"\\*]/g, " ").trim();
}

export default async function CustomersPage(props: PageProps<"/customers">) {
  const user = await requirePermission("sales.view");
  const params = await props.searchParams;

  const raw = params.q;
  const q = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  const page = Math.max(1, Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? "") || 1);

  const supabase = createClient(await cookies());

  // The summary view carries the totals, so the list and the detail page share
  // one definition of "total spent" and "last payment method".
  let query = supabase.from("customer_summary").select(CUSTOMER_SUMMARY_SELECT, { count: "exact" });

  const term = sanitize(q);
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const customers = (data ?? []).map(mapCustomerSummary);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (targetPage > 1) next.set("page", String(targetPage));
    const queryString = next.toString();
    return queryString ? `/customers?${queryString}` : "/customers";
  };

  return (
    <div>
      <TopBar
        title="Customers"
        description="Who buys from you, and what they have bought"
        action={hasPermission(user, "customers.manage") ? <AddCustomerButton /> : undefined}
      />
      <div className="p-4 sm:p-8">
        <CustomersManager
          customers={customers}
          canManage={hasPermission(user, "customers.manage")}
          filters={{ q }}
          page={page}
          total={total}
          prevHref={page > 1 ? hrefFor(page - 1) : null}
          nextHref={page < totalPages ? hrefFor(page + 1) : null}
        />
      </div>
    </div>
  );
}
