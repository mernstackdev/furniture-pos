"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { ResponsiveList, PaginationFooter, CardHeading, CardFields, CardField, CardActions } from "@/components/ui/ResponsiveList";
import { InventoryFilters, type InventoryFilterValues } from "@/components/InventoryFilters";
import { ProductForm } from "@/components/ProductForm";
import { deleteProduct, updateProduct, type InventoryState } from "@/app/(pos)/inventory/actions";
import { formatPKR } from "@/lib/format";
import { INVENTORY_QUERY_KEY, inventoryProductsQuery } from "@/lib/queries/inventory";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import {
  stockStatusLabel,
  stockStatusTone,
  type Category,
  type InventoryProduct,
} from "@/lib/inventory";

const initialState: InventoryState = { error: null, message: null };

export function InventoryManager({
  categories,
  canManage,
  filters,
  page,
  pageSize,
  prevHref,
  nextHref,
}: {
  categories: Category[];
  canManage: boolean;
  filters: InventoryFilterValues;
  page: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const supabase = useSupabaseBrowser();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InventoryProduct | null>(null);

  // The server render dehydrated this exact query key, so the first paint reads
  // from the cache rather than triggering a browser fetch. A revisit within the
  // stale window reuses it too.
  const { data, isPending } = useQuery(
    inventoryProductsQuery(supabase, { filters, page })
  );
  const products = data?.products ?? [];
  const total = data?.total ?? 0;

  // The delete lives here rather than in a form component, so the invalidation
  // belongs here too: revalidatePath refreshes the server render, but this cache
  // is the browser's, and without it the deleted row lingers until it goes stale.
  const deleteMutation = useServerAction({
    action: withoutPrevious(deleteProduct, initialState),
    invalidate: [INVENTORY_QUERY_KEY],
    onSuccess: () => setPendingDelete(null),
  });

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeFilterCount = [
    filters.q.trim() !== "",
    filters.category !== "all",
    filters.status !== "all",
    filters.minPrice.trim() !== "",
    filters.maxPrice.trim() !== "",
  ].filter(Boolean).length;

  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

  const emptyMessage = isPending
    ? "Loading products…"
    : activeFilterCount > 0
      ? "No products match these filters."
      : "No products found. Add your first product to get started.";

  function confirmDelete() {
    if (!pendingDelete) return;
    const formData = new FormData();
    formData.set("id", pendingDelete.id);
    formData.set("label", pendingDelete.name);
    deleteMutation.mutate(formData);
  }

  function openEditor(product: InventoryProduct) {
    setEditing(product);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Add product lives in the top bar. This row carries the mobile filter
          toggle and the read-only notice. */}
      <div className="flex items-center justify-between gap-3">
        <div className="sm:hidden">
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <FilterIcon />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            You have read-only access to inventory.
          </p>
        ) : null}
      </div>

      {/* Collapsible on mobile; always shown from sm up. */}
      <div className={filtersOpen ? "block" : "hidden sm:block"}>
        <InventoryFilters categories={categories} values={filters} />
      </div>

      <ResponsiveList
        rows={products}
        rowKey={(product) => product.id}
        emptyMessage={emptyMessage}
        card={(product) => (
          <>
            <CardHeading
              title={product.name}
              subtitle={product.sku}
              badge={
                <Badge tone={stockStatusTone[product.status]}>
                  {stockStatusLabel[product.status]}
                </Badge>
              }
            />
            <CardFields>
              <CardField label="Category">{product.categoryName}</CardField>
              <CardField label="Sell price">{formatPKR(product.sellPrice)}</CardField>
              <CardField label="Stock">
                {product.stockQty} {product.unit}(s)
              </CardField>
              <CardField label="Cost">{formatPKR(product.costPrice)}</CardField>
            </CardFields>
            {canManage ? (
              <CardActions>
                <Button variant="secondary" className="flex-1" onClick={() => openEditor(product)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => setPendingDelete(product)}
                >
                  Delete
                </Button>
              </CardActions>
            ) : null}
          </>
        )}
        columns={[
          {
            header: "Product",
            render: (product) => (
              <div>
                <p className="font-medium text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.sku}</p>
              </div>
            ),
          },
          { header: "Category", render: (product) => product.categoryName },
          { header: "Cost", render: (product) => formatPKR(product.costPrice) },
          { header: "Sell price", render: (product) => formatPKR(product.sellPrice) },
          { header: "Stock", render: (product) => `${product.stockQty} ${product.unit}(s)` },
          {
            header: "Status",
            render: (product) => (
              <Badge tone={stockStatusTone[product.status]}>
                {stockStatusLabel[product.status]}
              </Badge>
            ),
          },
          ...(canManage
            ? [
                {
                  header: "",
                  render: (product: InventoryProduct) => (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openEditor(product)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setPendingDelete(product)}>
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />

      <PaginationFooter
        summary={total === 0 ? "No products" : `Showing ${firstRow}–${lastRow} of ${total}`}
        page={page}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      {canManage ? (
        <>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit product">
            <ProductForm
              categories={categories}
              initial={editing ?? undefined}
              action={updateProduct}
              onDone={() => setModalOpen(false)}
              onCancel={() => setModalOpen(false)}
            />
          </Modal>

          <ConfirmDialog
            open={pendingDelete !== null}
            title="Delete product"
            pending={deleteMutation.isPending}
            message={
              <>
                Delete{" "}
                <span className="font-medium text-foreground">{pendingDelete?.name}</span>? This
                removes the product and its stock history, and cannot be undone.
              </>
            }
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        </>
      ) : null}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
