"use client";

import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { useAppData } from "@/lib/store";
import { formatPKR, formatDate } from "@/lib/format";

export default function InvoicesPage() {
  const { sales, customers } = useAppData();
  const router = useRouter();

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "Unknown" : "Walk-in customer");

  return (
    <div>
      <TopBar title="Invoices" description="All sales invoices generated from the POS" />
      <div className="p-4 sm:p-8">
        <DataTable
          rowKey={(s) => s.id}
          rows={sales}
          emptyMessage="No invoices yet. Complete a sale to generate one."
          onRowClick={(s) => router.push(`/invoices/${s.id}`)}
          columns={[
            { header: "Invoice #", render: (s) => <span className="font-medium text-foreground">{s.invoiceNo}</span> },
            { header: "Date", render: (s) => formatDate(s.date) },
            { header: "Customer", render: (s) => customerName(s.customerId) },
            { header: "Items", render: (s) => s.items.reduce((n, i) => n + i.qty, 0) },
            { header: "Total", render: (s) => formatPKR(s.total) },
            { header: "Status", render: (s) => <Badge tone={s.status === "paid" ? "success" : "warning"}>{s.status}</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
