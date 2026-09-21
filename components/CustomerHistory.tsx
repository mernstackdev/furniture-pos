"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import {
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { formatDateTime, formatPKR } from "@/lib/format";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { customerSalesQuery } from "@/lib/queries/customers";
import { paymentMethodLabel, saleStatusTone } from "@/lib/sales";

/**
 * Client component because ResponsiveList takes `card` and `columns` as
 * render functions, which cannot cross the server/client boundary.
 */
export function CustomerHistory({ customerId }: { customerId: string }) {
  const supabase = useSupabaseBrowser();
  // The page prefetched this exact key, so the first paint reads the cache.
  const { data, isPending } = useQuery(
    customerSalesQuery(supabase, { customerId })
  );
  const sales = data ?? [];

  return (
    <ResponsiveList
      rows={sales}
      rowKey={(sale) => sale.id}
      emptyMessage={isPending ? "Loading purchases…" : "No purchases yet."}
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
            subtitle={formatDateTime(sale.soldAt)}
            badge={<Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>}
          />
          <CardFields>
            <CardField label="Items">{sale.itemCount}</CardField>
            <CardField label="Total">{formatPKR(sale.total)}</CardField>
            <CardField label="Paid with">
              {paymentMethodLabel[sale.paymentMethod]}
            </CardField>
            <CardField label="Discount">{formatPKR(sale.discount)}</CardField>
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
        { header: "Date", render: (sale) => formatDateTime(sale.soldAt) },
        { header: "Items", render: (sale) => sale.itemCount },
        { header: "Paid with", render: (sale) => paymentMethodLabel[sale.paymentMethod] },
        { header: "Discount", render: (sale) => formatPKR(sale.discount) },
        { header: "Total", render: (sale) => formatPKR(sale.total) },
        {
          header: "Status",
          render: (sale) => (
            <Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>
          ),
        },
      ]}
    />
  );
}
