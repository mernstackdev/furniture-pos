"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { useSupabaseBrowser } from "@/lib/queries/client";
import {
  dashboardCustomerCountQuery,
  dashboardProductsQuery,
  dashboardRecentSalesQuery,
  dashboardTodaySalesQuery,
} from "@/lib/queries/dashboard";
import { formatPKR, formatDate } from "@/lib/format";
import { paymentMethodLabel, saleStatusTone } from "@/lib/sales";

/** Everything on this page now comes from Postgres. */
export function DashboardClient() {
  const supabase = useSupabaseBrowser();

  // The server prefetched each of these keys and the page hydrated the cache,
  // so the first paint reads it rather than issuing a browser fetch.
  const { data: products, isPending: productsPending } = useQuery(
    dashboardProductsQuery(supabase)
  );
  const { data: customerCount } = useQuery(dashboardCustomerCountQuery(supabase));
  const { data: todaysSales } = useQuery(dashboardTodaySalesQuery(supabase));
  const { data: recentSales, isPending: salesPending } = useQuery(
    dashboardRecentSalesQuery(supabase)
  );

  const allProducts = products ?? [];
  const lowStock = allProducts.filter(
    (product) => product.stockQty > 0 && product.stockQty <= product.lowStockThreshold
  );
  const outOfStock = allProducts.filter((product) => product.stockQty === 0);
  const alerts = [...outOfStock, ...lowStock];

  return (
    <div>
      <TopBar title="Dashboard" description="Today's snapshot of your furniture shop" />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today's Sales"
            value={formatPKR(todaysSales?.revenue ?? 0)}
            hint={`${todaysSales?.count ?? 0} invoice(s) today`}
          />
          <StatCard
            label="Total Products"
            value={allProducts.length.toString()}
            hint={`${customerCount ?? 0} customers on file`}
          />
          <StatCard
            label="Low Stock Items"
            value={lowStock.length.toString()}
            tone={lowStock.length > 0 ? "warning" : "default"}
            hint="At or below threshold"
          />
          <StatCard
            label="Out of Stock"
            value={outOfStock.length.toString()}
            tone={outOfStock.length > 0 ? "danger" : "default"}
            hint="Needs restocking"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Low stock alerts</h2>
            <ResponsiveList
              rows={alerts}
              rowKey={(product) => product.id}
              emptyMessage={
                productsPending ? "Loading stock alerts…" : "Everything is well stocked."
              }
              card={(product) => (
                <>
                  <CardHeading
                    title={product.name}
                    subtitle={product.categoryName}
                    badge={
                      <Badge tone={product.stockQty === 0 ? "danger" : "warning"}>
                        {product.stockQty === 0 ? "Out of stock" : `${product.stockQty} left`}
                      </Badge>
                    }
                  />
                  <CardFields>
                    <CardField label="Reorder at">{product.reorderPoint}</CardField>
                    <CardField label="Unit">{product.unit}</CardField>
                  </CardFields>
                </>
              )}
              columns={[
                { header: "Product", render: (product) => product.name },
                { header: "Category", render: (product) => product.categoryName },
                {
                  header: "Stock",
                  render: (product) => (
                    <Badge tone={product.stockQty === 0 ? "danger" : "warning"}>
                      {product.stockQty === 0 ? "Out of stock" : `${product.stockQty} left`}
                    </Badge>
                  ),
                },
              ]}
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent invoices</h2>
              <Link
                href="/invoices"
                className="cursor-pointer text-sm font-medium text-accent hover:underline"
              >
                View all
              </Link>
            </div>
            <ResponsiveList
              rows={recentSales ?? []}
              rowKey={(sale) => sale.id}
              emptyMessage={
                salesPending ? "Loading recent invoices…" : "No sales recorded yet."
              }
              card={(sale) => (
                <>
                  <CardHeading
                    title={
                      <Link
                        href={`/invoices/${sale.id}`}
                        className="cursor-pointer text-accent hover:underline"
                      >
                        {sale.invoiceNo}
                      </Link>
                    }
                    subtitle={sale.customerName}
                    badge={<Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>}
                  />
                  <CardFields>
                    <CardField label="Date">{formatDate(sale.soldAt)}</CardField>
                    <CardField label="Paid with">
                      {paymentMethodLabel[sale.paymentMethod]}
                    </CardField>
                    <CardField label="Total">{formatPKR(sale.total)}</CardField>
                  </CardFields>
                </>
              )}
              columns={[
                {
                  header: "Invoice",
                  render: (sale) => (
                    <Link
                      href={`/invoices/${sale.id}`}
                      className="cursor-pointer font-medium text-accent hover:underline"
                    >
                      {sale.invoiceNo}
                    </Link>
                  ),
                },
                { header: "Customer", render: (sale) => sale.customerName },
                { header: "Date", render: (sale) => formatDate(sale.soldAt) },
                {
                  header: "Paid with",
                  render: (sale) => paymentMethodLabel[sale.paymentMethod],
                },
                { header: "Total", render: (sale) => formatPKR(sale.total) },
                {
                  header: "Status",
                  render: (sale) => (
                    <Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>
                  ),
                },
              ]}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
