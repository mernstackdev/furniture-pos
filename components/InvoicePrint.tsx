"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime, formatPKR } from "@/lib/format";
import { useSupabaseBrowser } from "@/lib/queries/client";
import {
  invoiceCustomerQuery,
  invoiceItemsQuery,
  invoiceQuery,
} from "@/lib/queries/invoices";
import { useShopSettings } from "@/lib/settings";
import { paymentMethodLabel, saleStatusTone } from "@/lib/sales";

/**
 * The printable invoice. Shop name and tagline still come from the local
 * settings context, which is why this is a client component.
 */
export function InvoicePrint({ id }: { id: string }) {
  const { settings } = useShopSettings();
  const supabase = useSupabaseBrowser();

  // The page prefetched all three keys, so this renders from the cache.
  const { data: sale } = useQuery(invoiceQuery(supabase, { id }));
  const { data: items = [] } = useQuery(invoiceItemsQuery(supabase, { id }));

  const customerId = sale?.customerId ?? null;
  const { data: customer } = useQuery({
    ...invoiceCustomerQuery(supabase, { customerId: customerId ?? "" }),
    // A walk-in sale has no customer row to look up.
    enabled: customerId !== null,
  });
  const customerPhone = customer?.phone ?? null;
  const customerAddress = customer?.address ?? null;

  if (!sale) return null;

  return (
    <div>
      <TopBar
        title={sale.invoiceNo}
        description={formatDateTime(sale.soldAt)}
        action={
          <div className="flex gap-2">
            <Link
              href="/invoices"
              className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
            >
              Back
            </Link>
            <Button onClick={() => window.print()}>Print invoice</Button>
          </div>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="print-area mx-auto max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-lg font-semibold text-brand">{settings.shopName}</p>
              <p className="text-sm text-muted-foreground">{settings.shopTagline}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">{sale.invoiceNo}</p>
              <p className="text-muted-foreground">{formatDateTime(sale.soldAt)}</p>
            </div>
          </div>

          <div className="grid gap-4 border-b border-border py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Billed to</p>
              <p className="text-sm font-medium text-foreground">{sale.customerName}</p>
              {customerPhone ? (
                <p className="text-sm text-muted-foreground">{customerPhone}</p>
              ) : null}
              {customerAddress ? (
                <p className="text-sm text-muted-foreground">{customerAddress}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payment</p>
              <p className="text-sm text-foreground">
                {paymentMethodLabel[sale.paymentMethod]}
              </p>
              <Badge tone={saleStatusTone[sale.status]}>{sale.status}</Badge>
            </div>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2 text-foreground">{item.name}</td>
                  <td className="py-2 text-right text-foreground">{item.qty}</td>
                  <td className="py-2 text-right text-foreground">
                    {formatPKR(item.unitPrice)}
                  </td>
                  <td className="py-2 text-right text-foreground">
                    {formatPKR(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPKR(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatPKR(sale.discount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatPKR(sale.total)}</span>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Thank you for shopping with us!
          </p>
        </div>
      </div>
    </div>
  );
}
