"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { useToast } from "@/components/ui/Toast";
import { markSalePaid } from "@/app/(pos)/invoices/actions";
import { formatDate, formatPKR } from "@/lib/format";
import { paymentMethodLabel, saleStatusTone, type SaleRow } from "@/lib/sales";

export function InvoicesManager({
  sales,
  canManage,
}: {
  sales: SaleRow[];
  canManage: boolean;
}) {
  const toast = useToast();

  const [, markPaid, marking] = useActionState(
    async (_previous: { error: string | null }, formData: FormData) => {
      const result = await markSalePaid(formData);
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Invoice updated.");
      return result;
    },
    { error: null }
  );

  function actions(sale: SaleRow) {
    if (!canManage || sale.status === "paid") return null;
    return (
      <CardActions>
        <form
          action={markPaid}
          onSubmit={(event) => {
            event.stopPropagation();
          }}
        >
          <input type="hidden" name="id" value={sale.id} />
          <Button variant="secondary" disabled={marking} type="submit">
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
      emptyMessage="No invoices found."
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
                    <form action={markPaid}>
                      <input type="hidden" name="id" value={sale.id} />
                      <Button variant="secondary" disabled={marking} type="submit">
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
