"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { CategoryCombobox } from "./CategoryCombobox";
import type { InventoryState } from "@/app/(pos)/inventory/actions";
import { INVENTORY_QUERY_KEY } from "@/lib/queries/inventory";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import { productSchema, type ProductValues } from "@/lib/validation";
import type { Category, InventoryProduct } from "@/lib/inventory";

const initialState: InventoryState = { error: null, message: null };

interface ProductFormProps {
  categories: Category[];
  initial?: InventoryProduct;
  action: (state: InventoryState, formData: FormData) => Promise<InventoryState>;
  onDone: () => void;
  onCancel: () => void;
}

export function ProductForm({
  categories,
  initial,
  action,
  onDone,
  onCancel,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
      name: initial?.name ?? "",
      sku: initial?.sku ?? "",
      unit: initial?.unit ?? "pc",
      costPrice: initial?.costPrice,
      sellPrice: initial?.sellPrice,
      stockQty: initial?.stockQty ?? 0,
      lowStockThreshold: initial?.lowStockThreshold ?? 3,
      reorderPoint: initial?.reorderPoint ?? 0,
    },
  });

  // Dismissed from the mutation's success handler rather than from an effect,
  // which would cascade renders. This form owns the invalidation because it is
  // what writes; its callers only have to close the dialog.
  const mutation = useServerAction({
    action: withoutPrevious(action, initialState),
    invalidate: [INVENTORY_QUERY_KEY],
    onSuccess: () => onDone(),
  });

  // useWatch rather than watch(): RHF's watch cannot be memoized safely, which
  // React Compiler flags.
  const categoryId = useWatch({ control, name: "categoryId" });

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    if (initial) formData.set("id", initial.id);
    formData.set("categoryId", values.categoryId);
    formData.set("name", values.name);
    formData.set("sku", values.sku);
    formData.set("unit", values.unit);
    formData.set("costPrice", String(values.costPrice));
    formData.set("sellPrice", String(values.sellPrice));
    formData.set("stockQty", String(values.stockQty));
    formData.set("lowStockThreshold", String(values.lowStockThreshold));
    formData.set("reorderPoint", String(values.reorderPoint));
    mutation.mutate(formData);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Product name" error={errors.name?.message} className="col-span-2">
          <input
            {...register("name")}
            placeholder="e.g. Chesterfield 3-Seater Sofa"
            className="input"
          />
        </Field>

        <Field label="SKU" error={errors.sku?.message}>
          <input {...register("sku")} placeholder="e.g. SF-CH3-BRN" className="input" />
        </Field>

        <Field label="Category" error={errors.categoryId?.message}>
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
          />
        </Field>

        <Field label="Unit" error={errors.unit?.message}>
          <input {...register("unit")} placeholder="pc, set" className="input" />
        </Field>

        <Field label="Stock quantity" error={errors.stockQty?.message}>
          <input
            {...register("stockQty", { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="0"
            className="input"
          />
        </Field>

        <Field label="Cost price (PKR)" error={errors.costPrice?.message}>
          <input
            {...register("costPrice", { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="0"
            className="input"
          />
        </Field>

        <Field label="Sell price (PKR)" error={errors.sellPrice?.message}>
          <input
            {...register("sellPrice", { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="0"
            className="input"
          />
        </Field>

        <Field
          label="Low stock threshold"
          error={errors.lowStockThreshold?.message}
          hint="Status turns to Low stock at or below this."
        >
          <input
            {...register("lowStockThreshold", { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="3"
            className="input"
          />
        </Field>

        <Field
          label="Reorder point"
          error={errors.reorderPoint?.message}
          hint="Appears on the restock worklist at or below this."
        >
          <input
            {...register("reorderPoint", { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="0"
            className="input"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : initial ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
