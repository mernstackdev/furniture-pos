"use client";

import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppData } from "@/lib/store";
import { formatPKR, formatDateTime } from "@/lib/format";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { sales, customers, settings } = useAppData();

  const sale = sales.find((s) => s.id === id);

  if (!sale) {
    return (
      <div>
        <TopBar title="Invoice not found" />
        <div className="p-4 sm:p-8">
          <p className="text-muted-foreground">This invoice doesn&apos;t exist.</p>
          <Button className="mt-4" onClick={() => router.push("/invoices")}>Back to invoices</Button>
        </div>
      </div>
    );
  }

  const customer = sale.customerId ? customers.find((c) => c.id === sale.customerId) : null;

  return (
    <div>
      <TopBar
        title={sale.invoiceNo}
        description={formatDateTime(sale.date)}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/invoices")}>Back</Button>
            <Button onClick={() => window.print()}>Print invoice</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-8">
        <div className="print-area mx-auto max-w-2xl rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-lg font-semibold text-brand">{settings.shopName}</p>
              <p className="text-sm text-muted-foreground">{settings.shopTagline}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Invoice</p>
              <p className="text-lg font-semibold text-foreground">{sale.invoiceNo}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(sale.date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
              <p className="mt-1 font-medium text-foreground">{customer?.name ?? "Walk-in customer"}</p>
              {customer ? (
                <>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  <p className="text-sm text-muted-foreground">{customer.address}</p>
                </>
              ) : null}
            </div>
            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
              <p className="mt-1 font-medium capitalize text-foreground">{sale.paymentMethod}</p>
              <Badge tone={sale.status === "paid" ? "success" : "warning"}>{sale.status}</Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-105 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit price</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.productId} className="border-b border-border last:border-0">
                    <td className="py-2 text-foreground">{item.name}</td>
                    <td className="py-2">{item.qty}</td>
                    <td className="py-2 text-right">{formatPKR(item.unitPrice)}</td>
                    <td className="py-2 text-right">{formatPKR(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-6 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPKR(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatPKR(sale.discount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatPKR(sale.total)}</span>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">Thank you for shopping with us!</p>
        </div>
      </div>
    </div>
  );
}
