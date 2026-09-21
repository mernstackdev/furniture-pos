"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  PaginationFooter,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { PurchaseFilters, type PurchaseFilterValues, type VendorOption } from "@/components/PurchaseFilters";
import {
  cancelPurchaseOrder,
  receivePurchaseOrder,
  type PurchaseState,
} from "@/app/(pos)/purchases/actions";
import { formatDate, formatPKR } from "@/lib/format";
import { purchaseStatusTone, type PurchaseOrderRow } from "@/lib/inventory";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { withoutPrevious, useServerAction } from "@/lib/queries/mutation";
import { PURCHASES_QUERY_KEY, purchaseOrdersQuery } from "@/lib/queries/purchases";
import { INVENTORY_QUERY_KEY } from "@/lib/queries/inventory";
import { STOCK_QUERY_KEY } from "@/lib/queries/stock";
import { VENDORS_QUERY_KEY, vendorOptionsQuery } from "@/lib/queries/vendors";

const initialState: PurchaseState = { error: null, message: null };

export function PurchasesManager({
  canManage,
  filters,
  page,
  pageSize,
  prevHref,
  nextHref,
}: {
  canManage: boolean;
  filters: PurchaseFilterValues;
  page: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const supabase = useSupabaseBrowser();
  const [receiving, setReceiving] = useState<PurchaseOrderRow | null>(null);
  const [cancelling, setCancelling] = useState<PurchaseOrderRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The server render dehydrated these exact query keys, so the first paint
  // reads from the cache rather than triggering a browser fetch.
  const { data, isPending } = useQuery(purchaseOrdersQuery(supabase, { filters, page }));
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const { data: vendorData } = useQuery(vendorOptionsQuery(supabase));
  const vendors: VendorOption[] = (vendorData ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
  }));

  // Receiving puts stock on the shelf and writes movements and product cost, so
  // it touches the stock and inventory screens too; the rest are the order list
  // and vendor balances.
  const receiveMutation = useServerAction({
    action: withoutPrevious(receivePurchaseOrder, initialState),
    invalidate: [
      PURCHASES_QUERY_KEY,
      VENDORS_QUERY_KEY,
      INVENTORY_QUERY_KEY,
      STOCK_QUERY_KEY,
    ],
    onSuccess: () => setReceiving(null),
  });

  const cancelMutation = useServerAction({
    action: withoutPrevious(cancelPurchaseOrder, initialState),
    invalidate: [PURCHASES_QUERY_KEY],
    onSuccess: () => setCancelling(null),
  });

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeFilterCount = [
    filters.q.trim() !== "",
    filters.status !== "all",
    filters.vendor !== "all",
  ].filter(Boolean).length;

  const emptyMessage = isPending
    ? "Loading purchase orders…"
    : activeFilterCount > 0
      ? "No purchase orders match these filters."
      : "No purchase orders yet. Raising one is how stock normally comes in.";

  function confirmReceive() {
    if (!receiving) return;
    const formData = new FormData();
    formData.set("id", receiving.id);
    receiveMutation.mutate(formData);
  }

  function confirmCancel() {
    if (!cancelling) return;
    const formData = new FormData();
    formData.set("id", cancelling.id);
    cancelMutation.mutate(formData);
  }

  function actions(order: PurchaseOrderRow) {
    if (order.status === "received" || order.status === "cancelled") {
      return <span className="text-xs text-muted-foreground">No action needed</span>;
    }
    return (
      <CardActions>
        <Button variant="secondary" className="flex-1" onClick={() => setReceiving(order)}>
          Receive
        </Button>
        <Button variant="ghost" onClick={() => setCancelling(order)}>
          Cancel
        </Button>
      </CardActions>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="sm:hidden">
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            You have read-only access to purchases.
          </p>
        ) : null}
      </div>

      <div className={filtersOpen ? "block" : "hidden sm:block"}>
        <PurchaseFilters values={filters} vendors={vendors} />
      </div>

      <ResponsiveList
        rows={orders}
        rowKey={(order) => order.id}
        emptyMessage={emptyMessage}
        card={(order) => (
          <>
            <CardHeading
              title={order.vendorName}
              subtitle={order.reference ? `Bill ${order.reference}` : "No bill number"}
              badge={<Badge tone={purchaseStatusTone[order.status]}>{order.status}</Badge>}
            />
            <CardFields>
              <CardField label="Lines">{order.itemCount}</CardField>
              <CardField label="Cost">{formatPKR(order.totalCost)}</CardField>
              <CardField label="Received">
                {order.receivedAt ? (
                  formatDate(order.receivedAt)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </CardField>
              <CardField label="Created">{formatDate(order.createdAt)}</CardField>
            </CardFields>
            {canManage ? actions(order) : null}
          </>
        )}
        columns={[
          {
            header: "Vendor",
            render: (order) => (
              <div>
                <p className="font-medium text-foreground">{order.vendorName}</p>
                <p className="text-xs text-muted-foreground">
                  {order.reference ? `Bill ${order.reference}` : "No bill number"}
                </p>
              </div>
            ),
          },
          {
            header: "Status",
            render: (order) => (
              <Badge tone={purchaseStatusTone[order.status]}>{order.status}</Badge>
            ),
          },
          { header: "Lines", render: (order) => order.itemCount },
          { header: "Cost", render: (order) => formatPKR(order.totalCost) },
          {
            header: "Received",
            render: (order) =>
              order.receivedAt ? (
                formatDate(order.receivedAt)
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            header: "Created",
            render: (order) => (
              <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
            ),
          },
          ...(canManage
            ? [
                {
                  header: "",
                  render: (order: PurchaseOrderRow) =>
                    order.status === "received" || order.status === "cancelled" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setReceiving(order)}>
                          Receive
                        </Button>
                        <Button variant="ghost" onClick={() => setCancelling(order)}>
                          Cancel
                        </Button>
                      </div>
                    ),
                },
              ]
            : []),
        ]}
      />

      <PaginationFooter
        summary={total === 0 ? "No purchase orders" : `Showing ${firstRow}–${lastRow} of ${total}`}
        page={page}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      {canManage ? (
        <>
          <ConfirmDialog
            open={receiving !== null}
            title="Receive purchase order"
            confirmLabel="Receive stock"
            pendingLabel="Receiving…"
            pending={receiveMutation.isPending}
            message={
              <>
                Receive{" "}
                <span className="font-medium text-foreground">
                  {receiving?.itemCount} line(s)
                </span>{" "}
                from <span className="font-medium text-foreground">{receiving?.vendorName}</span>?
                This adds the quantities to stock, writes stock movements, and updates each
                product&apos;s cost price to the purchase cost.
              </>
            }
            onConfirm={confirmReceive}
            onCancel={() => setReceiving(null)}
          />

          <ConfirmDialog
            open={cancelling !== null}
            title="Cancel purchase order"
            confirmLabel="Cancel order"
            pendingLabel="Cancelling…"
            pending={cancelMutation.isPending}
            message={
              <>
                Cancel the order from{" "}
                <span className="font-medium text-foreground">{cancelling?.vendorName}</span>? The
                record is kept; nothing is removed from stock.
              </>
            }
            onConfirm={confirmCancel}
            onCancel={() => setCancelling(null)}
          />
        </>
      ) : null}
    </div>
  );
}
