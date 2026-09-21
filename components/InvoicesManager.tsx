"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { markSalePaid } from "@/app/(pos)/invoices/actions";
import { formatDate, formatPKR } from "@/lib/format";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { CUSTOMERS_QUERY_KEY } from "@/lib/queries/customers";
import {
  INVOICES_QUERY_KEY,
  invoicesQuery,
  type InvoiceFilterValues,
} from "@/lib/queries/invoices";
import { useServerAction } from "@/lib/queries/mutation";
import { paymentMethodLabel, saleStatusTone, type SaleRow } from "@/lib/sales";

export function InvoicesManager({
  canManage,
  filters,
  page,
}: {
  canManage: boolean;
  filters: InvoiceFilterValues;
  page: number;
}) {
  const supabase = useSupabaseBrowser();

  // The server render dehydrated this exact query key, so the first paint reads
  // from the cache rather than triggering a browser fetch.
  const { data, isPending } = useQuery(invoicesQuery(supabase, { filters, page }));
  const sales = data?.sales ?? [];

  // markSalePaid is already single-argument, so it needs no withoutPrevious.
  // Settling an invoice leaves stock alone, but it clears the customer's
  // outstanding balance, which the customers screen shows.
  const markPaid = useServerAction({
    action: markSalePaid,
    invalidate: [INVOICES_QUERY_KEY, CUSTOMERS_QUERY_KEY],
  });

  function actions(sale: SaleRow) {
    if (!canManage || sale.status === "paid") return null;
    return (
      <CardActions>
        <form
          action={markPaid.mutate}
          onSubmit={(event) => {
            event.stopPropagation();
          }}
        >
          <input type="hidden" name="id" value={sale.id} />
          <Button variant="secondary" disabled={markPaid.isPending} type="submit">
            Mark paid
          </Button>
        </form>
      </CardActions>
    );
  }

  return (
    <ResponsiveList
      rowKey={(sale) => sale.id}
      rows={sales}
      emptyMessage={isPending ? "Loading invoices…" : "No invoices found."}
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
            <CardField label="Items">{sale.itemCount}</CardField>
            <CardField label="Paid with">{paymentMethodLabel[sale.paymentMethod]}</CardField>
            <CardField label="Total">{formatPKR(sale.total)}</CardField>
          </CardFields>
          {actions(sale)}
        </>
      )}
      columns={[
        {
          header: "Invoice #",
          render: (sale) => (
            <Link
              href={`/invoices/${sale.id}`}
              className="cursor-pointer font-medium text-accent hover:underline"
            >
              {sale.invoiceNo}
            </Link>
          ),
        },
        { header: "Date", render: (sale) => formatDate(sale.soldAt) },
        { header: "Customer", render: (sale) => sale.customerName },
        { header: "Items", render: (sale) => sale.itemCount },
        { header: "Paid with", render: (sale) => paymentMethodLabel[sale.paymentMethod] },
        { header: "Total", render: (sale) => formatPKR(sale.total) },
        {
          header: "Status",
          render: (sale) => (
            <Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>
          ),
        },
        ...(canManage
          ? [
              {
                header: "",
                render: (sale: SaleRow) =>
                  sale.status === "paid" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <form action={markPaid.mutate}>
                      <input type="hidden" name="id" value={sale.id} />
                      <Button variant="secondary" disabled={markPaid.isPending} type="submit">
                        Mark paid
                      </Button>
                    </form>
                  ),
              },
            ]
          : []),
      ]}
    />
  );
}
