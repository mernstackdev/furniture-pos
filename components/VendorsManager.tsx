"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  PaginationFooter,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { VendorForm } from "@/components/VendorForm";
import { VendorPaymentForm } from "@/components/VendorPaymentForm";
import { VendorFilters, type VendorFilterValues } from "@/components/VendorFilters";
import { deletePayment, deleteVendor, type VendorState } from "@/app/(pos)/vendors/actions";
import { formatDate, formatPKR } from "@/lib/format";
import { vendorPaymentMethodLabel, type Vendor } from "@/lib/inventory";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { withoutPrevious, useServerAction } from "@/lib/queries/mutation";
import { recentPurchaseOrdersQuery } from "@/lib/queries/purchases";
import {
  VENDORS_QUERY_KEY,
  vendorPaymentsQuery,
  vendorsQuery,
} from "@/lib/queries/vendors";

const initialState: VendorState = { error: null, message: null };

export function VendorsManager({
  canManage,
  filters,
  page,
  pageSize,
  prevHref,
  nextHref,
}: {
  canManage: boolean;
  filters: VendorFilterValues;
  page: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const supabase = useSupabaseBrowser();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [payTarget, setPayTarget] = useState<Vendor | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Vendor | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The server render dehydrated these exact query keys, so the first paint
  // reads from the cache rather than triggering a browser fetch.
  const { data, isPending } = useQuery(vendorsQuery(supabase, { filters, page }));
  const vendors = data?.vendors ?? [];
  const balances = data?.balances ?? {};
  const total = data?.total ?? 0;
  const { data: paymentData } = useQuery(vendorPaymentsQuery(supabase));
  const payments = paymentData ?? [];
  const { data: orderData } = useQuery(recentPurchaseOrdersQuery(supabase));
  const orders = orderData ?? [];

  const deleteMutation = useServerAction({
    action: withoutPrevious(deleteVendor, initialState),
    invalidate: [VENDORS_QUERY_KEY],
    onSuccess: () => setDeleteTarget(null),
  });

  const paymentMutation = useServerAction({
    action: withoutPrevious(deletePayment, initialState),
    invalidate: [VENDORS_QUERY_KEY],
  });

  const balanceFor = (vendorId: string): number => balances[vendorId]?.outstanding ?? 0;

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilterCount = [filters.q.trim() !== "", filters.balance !== "all"].filter(
    Boolean
  ).length;

  const emptyMessage = isPending
    ? "Loading vendors…"
    : activeFilterCount > 0
      ? "No vendors match these filters."
      : "No vendors yet. Add the manufacturers and wholesalers you buy from.";

  function confirmDeleteVendor() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("id", deleteTarget.id);
    formData.set("label", deleteTarget.name);
    deleteMutation.mutate(formData);
  }

  function removePayment(paymentId: string) {
    const formData = new FormData();
    formData.set("id", paymentId);
    paymentMutation.mutate(formData);
  }

  const historyPayments = historyTarget
    ? payments.filter((payment) => payment.vendorId === historyTarget.id)
    : [];

  function actions(vendor: Vendor) {
    const outstanding = balanceFor(vendor.id);
    return (
      <CardActions>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setPayTarget(vendor)}
          disabled={outstanding <= 0}
          title={outstanding <= 0 ? "Nothing outstanding" : "Record a payment"}
        >
          Pay
        </Button>
        <Button variant="ghost" onClick={() => setHistoryTarget(vendor)}>
          History
        </Button>
        {canManage ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(vendor)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(vendor)}>
              Delete
            </Button>
          </>
        ) : null}
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
          <p className="text-sm text-muted-foreground">You have read-only access to vendors.</p>
        ) : null}
      </div>

      <div className={filtersOpen ? "block" : "hidden sm:block"}>
        <VendorFilters values={filters} />
      </div>

      <ResponsiveList
        rows={vendors}
        rowKey={(vendor) => vendor.id}
        emptyMessage={emptyMessage}
        card={(vendor) => (
          <>
            <CardHeading
              title={vendor.name}
              subtitle={[vendor.phone, vendor.city].filter(Boolean).join(" · ")}
              badge={
                <Badge tone={balanceFor(vendor.id) > 0 ? "warning" : "success"}>
                  {formatPKR(balanceFor(vendor.id))}
                </Badge>
              }
            />
            <CardFields>
              <CardField label="Purchased">
                {formatPKR(balances[vendor.id]?.purchasedTotal ?? 0)}
              </CardField>
              <CardField label="Paid">{formatPKR(balances[vendor.id]?.paidTotal ?? 0)}</CardField>
            </CardFields>
            {actions(vendor)}
          </>
        )}
        columns={[
          {
            header: "Vendor",
            render: (vendor) => (
              <div>
                <p className="font-medium text-foreground">{vendor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {vendor.phone}
                  {vendor.city ? ` · ${vendor.city}` : ""}
                </p>
              </div>
            ),
          },
          {
            header: "Purchased",
            render: (vendor) => formatPKR(balances[vendor.id]?.purchasedTotal ?? 0),
          },
          { header: "Paid", render: (vendor) => formatPKR(balances[vendor.id]?.paidTotal ?? 0) },
          {
            header: "Outstanding",
            render: (vendor) => (
              <Badge tone={balanceFor(vendor.id) > 0 ? "warning" : "success"}>
                {formatPKR(balanceFor(vendor.id))}
              </Badge>
            ),
          },
          { header: "", render: (vendor) => actions(vendor) },
        ]}
      />

      <PaginationFooter
        summary={total === 0 ? "No vendors" : `Showing ${firstRow}–${lastRow} of ${total}`}
        page={page}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      {canManage ? (
        <>
          <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit vendor">
            <VendorForm
              initial={editing ?? undefined}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </Modal>

          <Modal
            open={payTarget !== null}
            onClose={() => setPayTarget(null)}
            title="Record payment"
          >
            {payTarget ? (
              <VendorPaymentForm
                vendor={payTarget}
                orders={orders.filter((order) => order.vendorId === payTarget.id)}
                outstanding={balanceFor(payTarget.id)}
                onDone={() => setPayTarget(null)}
                onCancel={() => setPayTarget(null)}
              />
            ) : null}
          </Modal>

          <ConfirmDialog
            open={deleteTarget !== null}
            title="Delete vendor"
            pending={deleteMutation.isPending}
            message={
              <>
                Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
                Vendors linked to a purchase order or a payment cannot be deleted.
              </>
            }
            onConfirm={confirmDeleteVendor}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      ) : null}

      <Modal
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        title="Payment history"
      >
        {historyTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{historyTarget.name}</span> — purchased{" "}
              {formatPKR(balances[historyTarget.id]?.purchasedTotal ?? 0)}, paid{" "}
              {formatPKR(balances[historyTarget.id]?.paidTotal ?? 0)}, outstanding{" "}
              <span className="font-medium text-foreground">
                {formatPKR(balanceFor(historyTarget.id))}
              </span>
              .
            </p>

            {historyPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {historyPayments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{formatPKR(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.paidAt)} · {vendorPaymentMethodLabel[payment.method]}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </p>
                      {payment.note ? (
                        <p className="text-xs text-muted-foreground">{payment.note}</p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <Button variant="danger" onClick={() => removePayment(payment.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
