"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useActionToast } from "./ui/Toast";
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

  const [state, formAction, pending] = useActionState(
    async (previous: CustomerState, formData: FormData) => {
      const result = await action(previous, formData);
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
    formData.set("address", values.address);
    startTransition(() => formAction(formData));
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
