"use client";

import Link from "next/link";
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
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerFilters, type CustomerFilterValues } from "@/components/CustomerFilters";
import {
  deleteCustomer,
  saveCustomer,
  type CustomerState,
} from "@/app/(pos)/customers/actions";
import { formatDate, formatPKR } from "@/lib/format";
import { useSupabaseBrowser } from "@/lib/queries/client";
import {
  CUSTOMERS_PAGE_SIZE,
  CUSTOMERS_QUERY_KEY,
  customersQuery,
} from "@/lib/queries/customers";
import { INVOICES_QUERY_KEY } from "@/lib/queries/invoices";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import { paymentMethodLabel, type CustomerSummary } from "@/lib/sales";

const initialState: CustomerState = { error: null, message: null };

export function CustomersManager({
  canManage,
  filters,
  page,
  prevHref,
  nextHref,
}: {
  canManage: boolean;
  filters: CustomerFilterValues;
  page: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const supabase = useSupabaseBrowser();
  const [editing, setEditing] = useState<CustomerSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerSummary | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The server render dehydrated this exact query key, so the first paint reads
  // from the cache rather than triggering a browser fetch.
  const { data, isPending } = useQuery(customersQuery(supabase, { filters, page }));
  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;

  const deleteMutation = useServerAction({
    action: withoutPrevious(deleteCustomer, initialState),
    // Deleting a customer leaves their sales as walk-ins, which changes the
    // invoices list too.
    invalidate: [CUSTOMERS_QUERY_KEY, INVOICES_QUERY_KEY],
    onSuccess: () => setDeleteTarget(null),
  });

  const firstRow = total === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const lastRow = Math.min(page * CUSTOMERS_PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));

  function confirmDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("id", deleteTarget.id);
    formData.set("label", deleteTarget.name);
    deleteMutation.mutate(formData);
  }

  const lastPayment = (customer: CustomerSummary) =>
    customer.lastPaymentMethod ? paymentMethodLabel[customer.lastPaymentMethod] : "—";

  function actions(customer: CustomerSummary) {
    return (
      <CardActions>
        <Link
          href={`/customers/${customer.id}`}
          className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-95"
        >
          History
        </Link>
        {canManage ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(customer)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(customer)}>
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
            Search{filters.q ? " (1)" : ""}
          </Button>
        </div>
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            You have read-only access to customers.
          </p>
        ) : null}
      </div>

      <div className={filtersOpen ? "block" : "hidden sm:block"}>
        <CustomerFilters values={filters} />
      </div>

      <ResponsiveList
        rows={customers}
        rowKey={(customer) => customer.id}
        emptyMessage={
          isPending
            ? "Loading customers…"
            : filters.q
              ? "No customers match this search."
              : "No customers yet. Add one, or sell to a walk-in."
        }
        card={(customer) => (
          <>
            <CardHeading
              title={customer.name}
              subtitle={customer.phone}
              badge={<Badge tone={customer.outstanding > 0 ? "warning" : "neutral"}>
                {formatPKR(customer.totalSpent)}
              </Badge>}
            />
            <CardFields>
              <CardField label="Orders">{customer.orderCount}</CardField>
              <CardField label="Outstanding">
                {formatPKR(customer.outstanding)}
              </CardField>
              <CardField label="Last payment">{lastPayment(customer)}</CardField>
              <CardField label="Last order">
                {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
              </CardField>
            </CardFields>
            {actions(customer)}
          </>
        )}
        columns={[
          {
            header: "Customer",
            render: (customer) => (
              <div>
                <p className="font-medium text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.phone}</p>
              </div>
            ),
          },
          { header: "Orders", render: (customer) => customer.orderCount },
          { header: "Total spent", render: (customer) => formatPKR(customer.totalSpent) },
          {
            header: "Outstanding",
            render: (customer) => (
              <Badge tone={customer.outstanding > 0 ? "warning" : "neutral"}>
                {formatPKR(customer.outstanding)}
              </Badge>
            ),
          },
          { header: "Last payment", render: (customer) => lastPayment(customer) },
          {
            header: "Last order",
            render: (customer) => (
              <span className="text-muted-foreground">
                {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
              </span>
            ),
          },
          { header: "", render: (customer) => actions(customer) },
        ]}
      />

      <PaginationFooter
        summary={total === 0 ? "No customers" : `Showing ${firstRow}–${lastRow} of ${total}`}
        page={page}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      {canManage ? (
        <>
          <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit customer">
            <CustomerForm
              initial={editing ?? undefined}
              action={saveCustomer}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </Modal>

          <ConfirmDialog
            open={deleteTarget !== null}
            title="Delete customer"
            pending={deleteMutation.isPending}
            message={
              <>
                Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
                Their invoices are kept and will show as a walk-in sale.
              </>
            }
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      ) : null}
    </div>
  );
}
