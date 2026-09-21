"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "./ui/Button";
import { Combobox, type ComboboxOption } from "./ui/Combobox";
import { Field } from "./ui/Field";
import { Modal } from "./ui/Modal";
import { useActionToast } from "./ui/Toast";
import { VendorForm } from "./VendorForm";
import { createPurchaseOrder, type PurchaseState } from "@/app/(pos)/purchases/actions";
import { formatPKR } from "@/lib/format";
import { purchaseOrderSchema, type PurchaseOrderValues } from "@/lib/validation";
import type { InventoryProduct, Vendor } from "@/lib/inventory";

const initialState: PurchaseState = { error: null, message: null };

/**
 * Full-page form. Rendering it on a page rather than in a dialog gives the
 * line items room for real column headings.
 */
export function PurchaseOrderForm({
  vendors,
  products,
}: {
  vendors: Vendor[];
  products: InventoryProduct[];
}) {
  const router = useRouter();
  const [vendorModalOpen, setVendorModalOpen] = useState(false);

  // Shared by the form defaults and the watch defaults below.
  const initialItems = [
    {
      productId: products[0]?.id ?? "",
      qty: 1,
      unitCost: products[0]?.costPrice ?? 0,
    },
  ];
  const initialVendorId = vendors[0]?.id ?? "";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<PurchaseOrderValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      vendorId: initialVendorId,
      reference: "",
      notes: "",
      items: initialItems,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // useWatch reads the form's default values on the first render, so the server
  // and client markup agree without an explicit defaultValue.
  const lines = useWatch({ control, name: "items" });
  const vendorId = useWatch({ control, name: "vendorId" });

  const total = (lines ?? []).reduce(
    (sum, line) => sum + (Number(line?.qty) || 0) * (Number(line?.unitCost) || 0),
    0
  );

  const [state, formAction, pending] = useActionState(
    async (previous: PurchaseState, formData: FormData) => {
      const result = await createPurchaseOrder(previous, formData);
      if (result.message) router.push("/purchases");
      return result;
    },
    initialState
  );

  useActionToast(state);

  const vendorOptions: ComboboxOption[] = vendors.map((vendor) => ({
    value: vendor.id,
    label: vendor.name,
    hint: vendor.city || undefined,
  }));

  const productOptions: ComboboxOption[] = products.map((product) => ({
    value: product.id,
    label: product.name,
    hint: product.sku,
  }));

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    formData.set("vendorId", values.vendorId);
    formData.set("reference", values.reference ?? "");
    formData.set("notes", values.notes ?? "");
    // Sent as JSON; the action re-validates and maps the keys for the RPC.
    formData.set("items", JSON.stringify(values.items));
    startTransition(() => formAction(formData));
  });

  const noProducts = products.length === 0;
  const noVendors = vendors.length === 0;

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {noVendors ? (
          <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
            No vendors yet. Use “Add new vendor” below to create one — a purchase has to come
            from someone.
          </p>
        ) : null}

        {noProducts ? (
          <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
            Add products to inventory before raising a purchase order.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Vendor"
            error={errors.vendorId?.message}
            hint="Search by name, or add a new vendor from the list."
          >
            <Combobox
              options={vendorOptions}
              value={vendorId}
              onChange={(id) => setValue("vendorId", id, { shouldValidate: true })}
              placeholder="Search vendors…"
              actionLabel="+ Add new vendor"
              onAction={() => setVendorModalOpen(true)}
            />
          </Field>

          <Field
            label="Vendor bill number"
            error={errors.reference?.message}
            hint="Their invoice reference, for reconciliation."
          >
            <input {...register("reference")} placeholder="e.g. INV-2291" className="input" />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Products</h2>
            <Button
              type="button"
              variant="secondary"
              disabled={noProducts}
              onClick={() => append({ ...initialItems[0] })}
            >
              + Add line
            </Button>
          </div>

          {typeof errors.items?.message === "string" ? (
            <p className="mb-2 text-xs text-danger">{errors.items.message}</p>
          ) : null}

          {/* Column headings double as labels for the repeated inputs. */}
          <div className="mb-1 hidden grid-cols-12 gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span className="col-span-6">Product</span>
            <span className="col-span-2">Quantity</span>
            <span className="col-span-3">Unit cost (PKR)</span>
            <span className="col-span-1" />
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-1">
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
                      Product
                    </span>
                    <Combobox
                      options={productOptions}
                      value={lines?.[index]?.productId ?? ""}
                      onChange={(id) => {
                        const product = products.find((item) => item.id === id);
                        setValue(`items.${index}.productId`, id, { shouldValidate: true });
                        // Seed the cost from the product's current cost price.
                        if (product) {
                          setValue(`items.${index}.unitCost`, product.costPrice, {
                            shouldValidate: true,
                          });
                        }
                      }}
                      placeholder="Search products…"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
                      Quantity
                    </span>
                    <input
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      type="number"
                      min={1}
                      placeholder="1"
                      aria-label={`Quantity for line ${index + 1}`}
                      className="input"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
                      Unit cost (PKR)
                    </span>
                    <input
                      {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                      type="number"
                      min={0}
                      placeholder="0"
                      aria-label={`Unit cost for line ${index + 1}`}
                      className="input"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                {errors.items?.[index]?.qty?.message ? (
                  <p className="text-xs text-danger">{errors.items[index]?.qty?.message}</p>
                ) : null}
                {errors.items?.[index]?.unitCost?.message ? (
                  <p className="text-xs text-danger">{errors.items[index]?.unitCost?.message}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <Field label="Notes" error={errors.notes?.message}>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Delivery instructions, etc."
            className="input"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Order total</span>
          <span className="text-lg font-semibold text-foreground">{formatPKR(total)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/purchases")}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || noProducts}>
            {pending ? "Creating…" : "Create purchase order"}
          </Button>
        </div>
      </form>

      <Modal open={vendorModalOpen} onClose={() => setVendorModalOpen(false)} title="Add vendor">
        <VendorForm
          onDone={() => {
            setVendorModalOpen(false);
            // Re-render so the new vendor arrives in the prop list.
            router.refresh();
          }}
          onCancel={() => setVendorModalOpen(false)}
        />
      </Modal>
    </>
  );
}
