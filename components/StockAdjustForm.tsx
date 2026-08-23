"use client";

import { useState } from "react";
import type { Product, StockMovementType } from "@/lib/types";
import { Button } from "./ui/Button";

interface StockAdjustFormProps {
  product: Product;
  onSubmit: (type: StockMovementType, qty: number, reason: string) => void;
  onCancel: () => void;
}

const typeOptions: { value: StockMovementType; label: string }[] = [
  { value: "in", label: "Stock in (restock)" },
  { value: "out", label: "Stock out (damaged / removed)" },
  { value: "adjustment", label: "Correction (+/-)" },
];

export function StockAdjustForm({ product, onSubmit, onCancel }: StockAdjustFormProps) {
  const [type, setType] = useState<StockMovementType>("in");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(type, Number(qty) || 0, reason || "No reason given");
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Adjusting stock for <span className="font-medium text-foreground">{product.name}</span> — currently{" "}
        <span className="font-medium text-foreground">{product.stockQty}</span> {product.unit}(s)
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Movement type</span>
        <select value={type} onChange={(e) => setType(e.target.value as StockMovementType)} className="input">
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">
          {type === "adjustment" ? "Quantity change (use negative for reduction)" : "Quantity"}
        </span>
        <input required type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="input" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Reason</span>
        <input required value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="e.g. Restock from supplier" />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save movement</Button>
      </div>
    </form>
  );
}
