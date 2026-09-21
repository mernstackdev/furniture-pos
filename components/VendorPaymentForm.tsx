"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useActionToast } from "./ui/Toast";
import { recordPayment, type VendorState } from "@/app/(pos)/vendors/actions";
import { formatPKR } from "@/lib/format";
import { vendorPaymentSchema, type VendorPaymentValues } from "@/lib/validation";
import type { PurchaseOrderRow, Vendor } from "@/lib/inventory";

const initialState: VendorState = { error: null, message: null };

export function VendorPaymentForm({
  vendor,
  orders,
  outstanding,
  onDone,
  onCancel,
}: {
  vendor: Vendor;
  orders: PurchaseOrderRow[];
  outstanding: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorPaymentValues>({
    resolver: zodResolver(vendorPaymentSchema),
    defaultValues: {
      vendorId: vendor.id,
      purchaseOrderId: "",
      // Pre-fill the full balance: clearing it in one go is the common case.
      amount: outstanding > 0 ? outstanding : 0,
      method: "cash",
      reference: "",
      note: "",
    },
  });

  const [state, formAction, pending] = useActionState(
    async (previous: VendorState, formData: FormData) => {
      const result = await recordPayment(previous, formData);
      if (result.message) onDone();
      return result;
    },
    initialState
  );

  useActionToast(state);

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    formData.set("vendorId", values.vendorId);
    formData.set("purchaseOrderId", values.purchaseOrderId ?? "");
    formData.set("amount", String(values.amount));
    formData.set("method", values.method);
    formData.set("reference", values.reference ?? "");
    formData.set("note", values.note ?? "");
    startTransition(() => formAction(formData));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
        Outstanding with <span className="font-medium text-foreground">{vendor.name}</span> is{" "}
        <span className="font-medium text-foreground">{formatPKR(outstanding)}</span>.
      </p>

      <Field label="Amount (PKR)" error={errors.amount?.message}>
        <input
          {...register("amount", { valueAsNumber: true })}
          type="number"
          min={1}
          placeholder="0"
          className="input"
        />
      </Field>

      <Field
        label="Against bill"
        error={errors.purchaseOrderId?.message}
        hint="Leave as “On account” to clear the running balance instead."
      >
        <select {...register("purchaseOrderId")} className="input">
          <option value="">On account</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {(order.reference || order.id.slice(0, 8)) + ` · ${formatPKR(order.totalCost)} · ${order.status}`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Method" error={errors.method?.message}>
        <select {...register("method")} className="input">
          <option value="cash">Cash</option>
          <option value="bank">Bank transfer</option>
          <option value="cheque">Cheque</option>
          <option value="online">Online</option>
        </select>
      </Field>

      <Field label="Reference" error={errors.reference?.message} hint="Cheque no. or transfer ID.">
        <input {...register("reference")} placeholder="e.g. 004512" className="input" />
      </Field>

      <Field label="Note" error={errors.note?.message}>
        <input {...register("note")} placeholder="e.g. Part payment" className="input" />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
