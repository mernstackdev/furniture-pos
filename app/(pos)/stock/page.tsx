"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StockAdjustForm } from "@/components/StockAdjustForm";
import { useAppData } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import type { Product, StockMovementType } from "@/lib/types";

export default function StockPage() {
  const { products, stockMovements, adjustStock } = useAppData();
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Deleted product";
  const stockTone = (p: Product) => (p.stockQty === 0 ? "danger" : p.stockQty <= p.lowStockThreshold ? "warning" : "success");
  const stockLabel = (p: Product) => (p.stockQty === 0 ? "Out of stock" : p.stockQty <= p.lowStockThreshold ? "Low stock" : "In stock");

  const movementTone = (t: StockMovementType) => (t === "in" ? "success" : t === "out" ? "danger" : "neutral");

  return (
    <div>
      <TopBar title="Stock Management" description="Track stock levels and record stock movements" />
      <div className="space-y-8 p-4 sm:p-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Current stock levels</h2>
          <DataTable
            rowKey={(p) => p.id}
            rows={products}
            columns={[
              { header: "Product", render: (p) => p.name },
              { header: "Category", render: (p) => p.category },
              { header: "Quantity", render: (p) => `${p.stockQty} ${p.unit}(s)` },
              { header: "Threshold", render: (p) => `${p.lowStockThreshold} ${p.unit}(s)` },
              { header: "Status", render: (p) => <Badge tone={stockTone(p)}>{stockLabel(p)}</Badge> },
              {
                header: "",
                render: (p) => (
                  <Button variant="secondary" onClick={() => setAdjusting(p)}>Adjust stock</Button>
                ),
              },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Stock movement history</h2>
          <DataTable
            rowKey={(m) => m.id}
            rows={stockMovements}
            emptyMessage="No stock movements recorded yet."
            columns={[
              { header: "Date", render: (m) => formatDateTime(m.date) },
              { header: "Product", render: (m) => productName(m.productId) },
              { header: "Type", render: (m) => <Badge tone={movementTone(m.type)}>{m.type}</Badge> },
              { header: "Quantity", render: (m) => m.qty },
              { header: "Reason", render: (m) => m.reason },
            ]}
          />
        </section>
      </div>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title="Adjust stock">
        {adjusting ? (
          <StockAdjustForm
            product={adjusting}
            onCancel={() => setAdjusting(null)}
            onSubmit={(type, qty, reason) => {
              adjustStock(adjusting.id, type, qty, reason);
              setAdjusting(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
