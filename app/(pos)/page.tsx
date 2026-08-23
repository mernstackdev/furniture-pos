"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { useAppData } from "@/lib/store";
import { formatPKR, formatDate } from "@/lib/format";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function DashboardPage() {
  const { products, customers, sales } = useAppData();

  const today = new Date();
  const todaysSales = sales.filter((s) => isSameDay(new Date(s.date), today));
  const todaysRevenue = todaysSales.reduce((sum, s) => sum + s.total, 0);
  const lowStock = products.filter((p) => p.stockQty > 0 && p.stockQty <= p.lowStockThreshold);
  const outOfStock = products.filter((p) => p.stockQty === 0);
  const recentSales = [...sales].slice(0, 5);

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "Unknown" : "Walk-in customer");

  return (
    <div>
      <TopBar title="Dashboard" description="Today's snapshot of your furniture shop" />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's Sales" value={formatPKR(todaysRevenue)} hint={`${todaysSales.length} invoice(s) today`} />
          <StatCard label="Total Products" value={products.length.toString()} hint={`${customers.length} customers on file`} />
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
            <DataTable
              rowKey={(p) => p.id}
              rows={[...outOfStock, ...lowStock]}
              emptyMessage="Everything is well stocked."
              columns={[
                { header: "Product", render: (p) => p.name },
                { header: "Category", render: (p) => p.category },
                {
                  header: "Stock",
                  render: (p) => (
                    <Badge tone={p.stockQty === 0 ? "danger" : "warning"}>
                      {p.stockQty === 0 ? "Out of stock" : `${p.stockQty} left`}
                    </Badge>
                  ),
                },
              ]}
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent invoices</h2>
              <Link href="/invoices" className="text-sm font-medium text-accent hover:underline">View all</Link>
            </div>
            <DataTable
              rowKey={(s) => s.id}
              rows={recentSales}
              emptyMessage="No sales recorded yet."
              columns={[
                { header: "Invoice", render: (s) => s.invoiceNo },
                { header: "Customer", render: (s) => customerName(s.customerId) },
                { header: "Date", render: (s) => formatDate(s.date) },
                { header: "Total", render: (s) => formatPKR(s.total) },
                {
                  header: "Status",
                  render: (s) => <Badge tone={s.status === "paid" ? "success" : "warning"}>{s.status}</Badge>,
                },
              ]}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
