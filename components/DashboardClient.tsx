"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { formatPKR, formatDate } from "@/lib/format";
import { paymentMethodLabel, saleStatusTone, type SaleRow } from "@/lib/sales";
import type { InventoryProduct } from "@/lib/inventory";

/** Everything on this page now comes from Postgres. */
export function DashboardClient({
  totalProducts,
  lowStockCount,
  outOfStockCount,
  customerCount,
  alerts,
  todaysRevenue,
  todaysSaleCount,
  recentSales,
}: {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  customerCount: number;
  alerts: InventoryProduct[];
  todaysRevenue: number;
  todaysSaleCount: number;
  recentSales: SaleRow[];
}) {
  return (
    <div>
      <TopBar title="Dashboard" description="Today's snapshot of your furniture shop" />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today's Sales"
            value={formatPKR(todaysRevenue)}
            hint={`${todaysSaleCount} invoice(s) today`}
          />
          <StatCard
            label="Total Products"
            value={totalProducts.toString()}
            hint={`${customerCount} customers on file`}
          />
          <StatCard
            label="Low Stock Items"
            value={lowStockCount.toString()}
            tone={lowStockCount > 0 ? "warning" : "default"}
            hint="At or below threshold"
          />
          <StatCard
            label="Out of Stock"
            value={outOfStockCount.toString()}
            tone={outOfStockCount > 0 ? "danger" : "default"}
            hint="Needs restocking"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Low stock alerts</h2>
            <ResponsiveList
              rows={alerts}
              rowKey={(product) => product.id}
              emptyMessage="Everything is well stocked."
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
              rows={recentSales}
              rowKey={(sale) => sale.id}
              emptyMessage="No sales recorded yet."
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
