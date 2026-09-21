"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { adjustStock, type StockState } from "@/app/(pos)/stock/actions";
import { INVENTORY_QUERY_KEY } from "@/lib/queries/inventory";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import { STOCK_QUERY_KEY } from "@/lib/queries/stock";
import { stockAdjustSchema, type StockAdjustValues } from "@/lib/validation";
import type { InventoryProduct } from "@/lib/inventory";

const initialState: StockState = { error: null, message: null };

const typeOptions: { value: StockAdjustValues["type"]; label: string }[] = [
  { value: "in", label: "Stock in (restock)" },
  { value: "out", label: "Stock out (damaged / removed)" },
  { value: "adjustment", label: "Correction (+/-)" },
];

export function StockAdjustForm({
  product,
  onDone,
  onCancel,
}: {
  product: InventoryProduct;
  onDone: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StockAdjustValues>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      productId: product.id,
      type: "in",
      qty: 1,
      reason: "",
    },
  });

  const type = useWatch({ control, name: "type" });

  const mutation = useServerAction({
    action: withoutPrevious(adjustStock, initialState),
    // An adjustment rewrites the product's quantity and its stock_status, so
    // both this screen and the inventory list have to refresh.
    invalidate: [STOCK_QUERY_KEY, INVENTORY_QUERY_KEY],
    onSuccess: onDone,
  });

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    formData.set("productId", values.productId);
    formData.set("type", values.type);
    formData.set("qty", String(values.qty));
    formData.set("reason", values.reason ?? "");
    mutation.mutate(formData);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Adjusting stock for <span className="font-medium text-foreground">{product.name}</span> —
        currently <span className="font-medium text-foreground">{product.stockQty}</span>{" "}
        {product.unit}(s)
      </p>

      <Field label="Movement type" error={errors.type?.message}>
        <select {...register("type")} className="input">
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={type === "adjustment" ? "Quantity change (negative reduces)" : "Quantity"}
        error={errors.qty?.message}
      >
        <input
          {...register("qty", { valueAsNumber: true })}
          type="number"
          placeholder={type === "adjustment" ? "e.g. -2" : "e.g. 5"}
          className="input"
        />
      </Field>

      <Field label="Reason" error={errors.reason?.message}>
        <input
          {...register("reason")}
          placeholder="e.g. Restock from vendor"
          className="input"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save movement"}
        </Button>
      </div>
    </form>
  );
}
