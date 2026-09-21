import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { CustomerHistory } from "@/components/CustomerHistory";
import { requirePermission } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/format";
import { customerSalesQuery, customerSummaryQuery } from "@/lib/queries/customers";
import { makeQueryClient } from "@/lib/queryClient";
import { paymentMethodLabel } from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

export default async function CustomerDetailPage(props: PageProps<"/customers/[id]">) {
  await requirePermission("sales.view");
  const { id } = await props.params;

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery: the summary drives the stat cards and decides whether this
  // customer exists at all, so it has to resolve before the page can render.
  const customer = await queryClient.fetchQuery(customerSummaryQuery(supabase, { id }));
  if (!customer) notFound();

  // The history count in the heading comes from the same query the client list
  // reads, so it fills the cache dehydrated below rather than being passed down.
  const sales = await queryClient.fetchQuery(
    customerSalesQuery(supabase, { customerId: id })
  );

  return (
    <div>
      <TopBar
        title={customer.name}
        description={customer.phone}
        action={
          <Link
            href="/customers"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
          >
            ← Back<span className="hidden sm:inline"> to customers</span>
          </Link>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total spent"
            value={formatPKR(customer.totalSpent)}
            hint={`${customer.orderCount} order(s)`}
          />
          <StatCard
            label="Outstanding"
            value={formatPKR(customer.outstanding)}
            tone={customer.outstanding > 0 ? "warning" : "default"}
            hint={customer.outstanding > 0 ? "Unpaid invoices" : "Fully settled"}
          />
          <StatCard
            label="Last payment method"
            value={
              customer.lastPaymentMethod ? paymentMethodLabel[customer.lastPaymentMethod] : "—"
            }
            hint={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "No orders yet"}
          />
          <StatCard
            label="Last order"
            value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
            hint="Most recent purchase"
          />
        </div>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Contact</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="text-foreground">{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Customer since</dt>
              <dd className="text-foreground">{formatDate(customer.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Address</dt>
              <dd className="text-foreground">{customer.address || "—"}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Purchase history
            <span className="ml-2 font-normal text-muted-foreground">
              {sales.length} invoice{sales.length === 1 ? "" : "s"}
            </span>
          </h2>

          <HydrationBoundary state={dehydrate(queryClient)}>
            <CustomerHistory customerId={id} />
          </HydrationBoundary>
        </section>
      </div>
    </div>
  );
}
