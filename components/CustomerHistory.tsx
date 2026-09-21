"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { formatDateTime, formatPKR } from "@/lib/format";
import { paymentMethodLabel, saleStatusTone, type SaleRow } from "@/lib/sales";

/**
 * Client component because ResponsiveList takes `card` and `columns` as
 * render functions, which cannot cross the server/client boundary.
 */
export function CustomerHistory({ sales }: { sales: SaleRow[] }) {
  return (
    <ResponsiveList
      rows={sales}
      rowKey={(sale) => sale.id}
      emptyMessage="No purchases yet."
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
