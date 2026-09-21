"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useActionToast } from "./ui/Toast";
import { saveVendor, type VendorState } from "@/app/(pos)/vendors/actions";
import { vendorSchema, type VendorValues } from "@/lib/validation";
import type { Vendor } from "@/lib/inventory";

const initialState: VendorState = { error: null, message: null };

export function VendorForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Vendor;
  onDone: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      city: initial?.city ?? "",
      address: initial?.address ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const [state, formAction, pending] = useActionState(
    async (previous: VendorState, formData: FormData) => {
      const result = await saveVendor(previous, formData);
      if (result.message) onDone();
      return result;
    },
    initialState
  );

  useActionToast(state);

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    if (initial) formData.set("id", initial.id);
    formData.set("name", values.name);
    formData.set("phone", values.phone);
    formData.set("city", values.city ?? "");
    formData.set("address", values.address ?? "");
    formData.set("notes", values.notes ?? "");
    startTransition(() => formAction(formData));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Vendor name" error={errors.name?.message}>
        <input
          {...register("name")}
          placeholder="e.g. Gujranwala Furniture Works"
          className="input"
        />
      </Field>

      <Field label="Mobile number" error={errors.phone?.message}>
        <input {...register("phone")} placeholder="0300-1234567" inputMode="tel" className="input" />
      </Field>

      <Field label="City" error={errors.city?.message}>
        <input {...register("city")} placeholder="e.g. Gujranwala" className="input" />
      </Field>

      <Field label="Address" error={errors.address?.message}>
        <textarea
          {...register("address")}
          placeholder="Workshop / shop address"
          rows={2}
          className="input"
        />
      </Field>

      <Field label="Notes" error={errors.notes?.message} hint="Payment terms, delivery days, etc.">
        <textarea
          {...register("notes")}
          placeholder="e.g. 30-day credit, delivers on Mondays"
          rows={2}
          className="input"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add vendor"}
        </Button>
      </div>
    </form>
  );
}
