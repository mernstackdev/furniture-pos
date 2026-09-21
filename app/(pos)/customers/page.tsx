import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { AddCustomerButton } from "@/components/AddCustomerButton";
import { CustomersManager } from "@/components/CustomersManager";
import { hasPermission, requirePermission } from "@/lib/auth";
import { CUSTOMERS_PAGE_SIZE, customersQuery } from "@/lib/queries/customers";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function CustomersPage(props: PageProps<"/customers">) {
  const user = await requirePermission("sales.view");
  const params = await props.searchParams;

  const raw = params.q;
  const q = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  const page = Math.max(1, Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? "") || 1);

  const filters = { q };

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery rather than prefetchQuery: the page number's hrefs depend on the
  // total, which has to resolve before the footer can render. The same call
  // fills the cache dehydrated below, so the browser list renders without a
  // query of its own.
  const { total } = await queryClient.fetchQuery(
    customersQuery(supabase, { filters, page })
  );

  const totalPages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));

  // Plain links, so paging works without client JS and keeps the search.
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
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CustomersManager
            canManage={hasPermission(user, "customers.manage")}
            filters={filters}
            page={page}
            prevHref={page > 1 ? hrefFor(page - 1) : null}
            nextHref={page < totalPages ? hrefFor(page + 1) : null}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
