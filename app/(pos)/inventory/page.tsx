"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/components/ProductForm";
import { useAppData } from "@/lib/store";
import { formatPKR } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function InventoryPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useAppData();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const stockTone = (p: Product) => (p.stockQty === 0 ? "danger" : p.stockQty <= p.lowStockThreshold ? "warning" : "success");
  const stockLabel = (p: Product) => (p.stockQty === 0 ? "Out of stock" : p.stockQty <= p.lowStockThreshold ? "Low stock" : "In stock");

  return (
    <div>
      <TopBar
        title="Inventory Management"
        description="Manage your product catalog, pricing, and details"
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Add product</Button>}
      />
      <div className="space-y-4 p-4 sm:p-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or category..."
          className="input max-w-sm"
        />
        <DataTable
          rowKey={(p) => p.id}
          rows={filtered}
          emptyMessage="No products found."
          columns={[
            { header: "Product", render: (p) => (
              <div>
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
              </div>
            ) },
            { header: "Category", render: (p) => p.category },
            { header: "Cost", render: (p) => formatPKR(p.costPrice) },
            { header: "Sell price", render: (p) => formatPKR(p.sellPrice) },
            { header: "Stock", render: (p) => `${p.stockQty} ${p.unit}(s)` },
            { header: "Status", render: (p) => <Badge tone={stockTone(p)}>{stockLabel(p)}</Badge> },
            {
              header: "",
              render: (p) => (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setEditing(p); setModalOpen(true); }}>Edit</Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"? This cannot be undone.`)) deleteProduct(p.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit product" : "Add product"}>
        <ProductForm
          initial={editing ?? undefined}
          onCancel={() => setModalOpen(false)}
          onSubmit={(values) => {
            if (editing) updateProduct(editing.id, values);
            else addProduct(values);
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
