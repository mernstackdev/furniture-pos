"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { createCustomerForSale } from "@/app/(pos)/sales/actions";
import { CUSTOMERS_QUERY_KEY } from "@/lib/queries/customers";
import { SALES_CUSTOMERS_KEY } from "@/lib/queries/sales";
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
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: initialName, phone: "", address: "" },
  });

  /**
   * The action returns `{ customer } | { error }`, not the app-wide
   * `{ error, message }` that `useServerAction` keys success off, so this is a
   * plain mutation. Errors stay inline in the modal — the dialog is the context
   * the user is looking at — rather than becoming a toast.
   */
  const createCustomer = useMutation({
    mutationFn: (values: CustomerValues) => createCustomerForSale(values),
    onSuccess: (result) => {
      if ("error" in result) return;

      // A new customer changes the customers list on this and every screen, so
      // invalidate the caches instead of holding a local copy that the next
      // visit would not see.
      queryClient.invalidateQueries({ queryKey: SALES_CUSTOMERS_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      onCreated(result.customer);
    },
  });

  const serverError =
    createCustomer.data && "error" in createCustomer.data
      ? createCustomer.data.error
      : createCustomer.error?.message ?? null;

  return (
    <Modal open onClose={onCancel} title="New customer">
      <form
        onSubmit={handleSubmit((values) => createCustomer.mutate(values))}
        className="space-y-4"
        noValidate
      >
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

        {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Saving…" : "Add customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
