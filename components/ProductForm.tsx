"use client";

import { useState } from "react";
import type { Product, ProductCategory } from "@/lib/types";
import { Button } from "./ui/Button";

const categories: ProductCategory[] = ["Sofas", "Beds", "Dining", "Wardrobes", "Chairs", "Tables", "Decor"];

interface ProductFormProps {
  initial?: Product;
  onSubmit: (values: Omit<Product, "id" | "createdAt">) => void;
  onCancel: () => void;
}

export function ProductForm({ initial, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState<ProductCategory>(initial?.category ?? "Sofas");
  const [unit, setUnit] = useState(initial?.unit ?? "pc");
  const [costPrice, setCostPrice] = useState(initial?.costPrice?.toString() ?? "");
  const [sellPrice, setSellPrice] = useState(initial?.sellPrice?.toString() ?? "");
  const [stockQty, setStockQty] = useState(initial?.stockQty?.toString() ?? "0");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.lowStockThreshold?.toString() ?? "3");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          sku,
          category,
          unit,
          costPrice: Number(costPrice) || 0,
          sellPrice: Number(sellPrice) || 0,
          stockQty: Number(stockQty) || 0,
          lowStockThreshold: Number(lowStockThreshold) || 0,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Product name" className="col-span-2">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="SKU">
          <input required value={sku} onChange={(e) => setSku(e.target.value)} className="input" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="input">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Unit">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className="input" placeholder="pc, set" />
        </Field>
        <Field label="Stock quantity">
          <input required type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="input" />
        </Field>
        <Field label="Cost price (PKR)">
          <input required type="number" min={0} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="input" />
        </Field>
        <Field label="Sell price (PKR)">
          <input required type="number" min={0} value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="input" />
        </Field>
        <Field label="Low stock threshold">
          <input required type="number" min={0} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="input" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? "Save changes" : "Add product"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
