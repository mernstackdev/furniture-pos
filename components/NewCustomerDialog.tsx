"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { createCustomerForSale } from "@/app/(pos)/sales/actions";
import { customerSchema, type CustomerValues } from "@/lib/validation";
import type { Customer } from "@/lib/sales";

/**
 * Adding a customer from the till. A phone and address are required — the
 * address is printed on the invoice — so "Create X" in the customer search
 * opens this pre-filled rather than inserting a bare name.
 *
 * Mount with `key={initialName}` so a different search term re-seeds the form.
 */
export function NewCustomerDialog({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: initialName, phone: "", address: "" },
  });

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    setPending(true);
    const result = await createCustomerForSale(values);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onCreated(result.customer);
  });

  return (
    <Modal open onClose={onCancel} title="New customer">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}>
          <input {...register("name")} placeholder="e.g. Ahmed Raza" className="input" />
        </Field>

        <Field label="Phone number" error={errors.phone?.message}>
          <input
            {...register("phone")}
            placeholder="0300-1234567"
            inputMode="tel"
            className="input"
          />
        </Field>

        <Field label="Address" error={errors.address?.message}>
          <textarea
            {...register("address")}
            placeholder="House / street, area, city"
            className="input"
            rows={3}
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
