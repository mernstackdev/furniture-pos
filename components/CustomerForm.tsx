"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { CUSTOMERS_QUERY_KEY } from "@/lib/queries/customers";
import { INVOICES_QUERY_KEY } from "@/lib/queries/invoices";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import type { CustomerState } from "@/app/(pos)/customers/actions";
import { customerSchema, type CustomerValues } from "@/lib/validation";
import type { Customer } from "@/lib/sales";

const initialState: CustomerState = { error: null, message: null };

interface CustomerFormProps {
  initial?: Customer;
  action: (state: CustomerState, formData: FormData) => Promise<CustomerState>;
  onDone: () => void;
  onCancel: () => void;
}

export function CustomerForm({ initial, action, onDone, onCancel }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      address: initial?.address ?? "",
    },
  });

  const mutation = useServerAction({
    action: withoutPrevious(action, initialState),
    // Renaming a customer changes the name embedded in every past invoice, so
    // an edit has to refresh that list as well as this one.
    invalidate: initial
      ? [CUSTOMERS_QUERY_KEY, INVOICES_QUERY_KEY]
      : [CUSTOMERS_QUERY_KEY],
    onSuccess: () => onDone(),
  });

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    if (initial) formData.set("id", initial.id);
    formData.set("name", values.name);
    formData.set("phone", values.phone);
    formData.set("address", values.address);
    mutation.mutate(formData);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Full name" error={errors.name?.message}>
        <input {...register("name")} placeholder="e.g. Ahmed Raza" className="input" />
      </Field>

      <Field label="Phone number" error={errors.phone?.message}>
        <input {...register("phone")} placeholder="0300-1234567" inputMode="tel" className="input" />
      </Field>

      <Field label="Address" error={errors.address?.message}>
        <textarea
          {...register("address")}
          placeholder="House / street, area, city"
          className="input"
          rows={3}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : initial ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
