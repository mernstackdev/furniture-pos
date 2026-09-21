"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { StockAdjustForm } from "@/components/StockAdjustForm";
import { formatDateTime } from "@/lib/format";
import {
  movementTone,
  stockStatusLabel,
  stockStatusTone,
  type InventoryProduct,
  type StockMovementRow,
} from "@/lib/inventory";

export function StockManager({
  products,
  movements,
  restock,
  canManage,
}: {
  products: InventoryProduct[];
  movements: StockMovementRow[];
  restock: InventoryProduct[];
  canManage: boolean;
}) {
  const [adjusting, setAdjusting] = useState<InventoryProduct | null>(null);

  return (
    <div className="space-y-8">
      {restock.length > 0 ? (
        <section className="rounded-xl border border-warning bg-warning-bg p-5">
          <h2 className="text-sm font-semibold text-warning">
            Needs restocking ({restock.length})
          </h2>
          <p className="mt-1 text-sm text-warning">
            At or below the reorder point. Raise a purchase order, or adjust stock if it came in
            off the books.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {restock.map((product) => (
              <span
                key={product.id}
                className="rounded-lg border border-warning bg-surface px-3 py-2 text-sm text-foreground"
              >
                {product.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {product.stockQty} / reorder at {product.reorderPoint}
                </span>
              </span>
            ))}
          </div>
          {canManage ? (
            <Link
              href="/purchases/new"
              className="mt-3 inline-block cursor-pointer text-sm font-medium text-accent hover:underline"
            >
              Raise a purchase order
            </Link>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Current stock levels</h2>
          {!canManage ? (
            <p className="text-sm text-muted-foreground">You have read-only access to stock.</p>
          ) : null}
        </div>

        <ResponsiveList
          rows={products}
          rowKey={(product) => product.id}
          emptyMessage="No products yet."
          card={(product) => (
            <>
              <CardHeading
                title={product.name}
                subtitle={product.categoryName}
                badge={
                  <Badge tone={stockStatusTone[product.status]}>
                    {stockStatusLabel[product.status]}
                  </Badge>
                }
              />
              <CardFields>
                <CardField label="Quantity">
                  {product.stockQty} {product.unit}(s)
                </CardField>
                <CardField label="Threshold">
                  {product.lowStockThreshold} {product.unit}(s)
                </CardField>
                <CardField label="Reorder at">{product.reorderPoint}</CardField>
              </CardFields>
              {canManage ? (
                <CardActions>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setAdjusting(product)}
                  >
                    Adjust stock
                  </Button>
                </CardActions>
              ) : null}
            </>
          )}
          columns={[
            { header: "Product", render: (product) => product.name },
            { header: "Category", render: (product) => product.categoryName },
            {
              header: "Quantity",
              render: (product) => `${product.stockQty} ${product.unit}(s)`,
            },
            {
              header: "Threshold",
              render: (product) => `${product.lowStockThreshold} ${product.unit}(s)`,
            },
            { header: "Reorder at", render: (product) => product.reorderPoint },
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
                      <Button variant="secondary" onClick={() => setAdjusting(product)}>
                        Adjust stock
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Stock movement history</h2>

        <ResponsiveList
          rows={movements}
          rowKey={(movement) => movement.id}
          emptyMessage="No stock movements recorded yet."
          card={(movement) => (
            <>
              <CardHeading
                title={movement.productName}
                subtitle={formatDateTime(movement.createdAt)}
                badge={<Badge tone={movementTone[movement.type]}>{movement.type}</Badge>}
              />
              <CardFields>
                {/* qty_change is signed; the badge already conveys direction. */}
                <CardField label="Quantity">{Math.abs(movement.qtyChange)}</CardField>
                <CardField label="Source">
                  {movement.purchaseOrderId ? "Purchase" : "Manual"}
                </CardField>
                <CardField label="Reason">{movement.reason}</CardField>
                <CardField label="Recorded by">
                  {movement.createdByName ?? "System"}
                </CardField>
              </CardFields>
            </>
          )}
          columns={[
            { header: "Date", render: (movement) => formatDateTime(movement.createdAt) },
            { header: "Product", render: (movement) => movement.productName },
            {
              header: "Type",
              render: (movement) => (
                <Badge tone={movementTone[movement.type]}>{movement.type}</Badge>
              ),
            },
            { header: "Quantity", render: (movement) => Math.abs(movement.qtyChange) },
            { header: "Reason", render: (movement) => movement.reason },
            {
              header: "Source",
              render: (movement) =>
                movement.purchaseOrderId ? (
                  <Link href="/purchases" className="cursor-pointer text-accent hover:underline">
                    Purchase
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Manual</span>
                ),
            },
            {
              header: "Recorded by",
              render: (movement) => (
                <span className="text-muted-foreground">{movement.createdByName ?? "System"}</span>
              ),
            },
          ]}
        />
      </section>

      {canManage ? (
        <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="Adjust stock">
          {adjusting ? (
            <StockAdjustForm
              product={adjusting}
              onDone={() => setAdjusting(null)}
              onCancel={() => setAdjusting(null)}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
