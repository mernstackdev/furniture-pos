"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { createUser, type StaffState } from "@/app/(pos)/users/actions";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import { STAFF_QUERY_KEY } from "@/lib/queries/staff";
import { staffCreateSchema, type StaffCreateValues } from "@/lib/validation";

const initialState: StaffState = { error: null, message: null };

/** Lives in the page's top bar so the staff list keeps the body to itself. */
export function AddStaffButton() {
  const [open, setOpen] = useState(false);

  const form = useForm<StaffCreateValues>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: { fullName: "", email: "", password: "", role: "cashier" },
  });

  const mutation = useServerAction({
    action: withoutPrevious(createUser, initialState),
    // The new account is a profile row the staff list now reads from the cache,
    // so the invalidation replaces the old server revalidatePath.
    invalidate: [STAFF_QUERY_KEY],
    onSuccess: () => {
      setOpen(false);
      form.reset();
    },
  });

  const submit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("fullName", values.fullName);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("role", values.role);
    mutation.mutate(formData);
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add<span className="hidden sm:inline"> staff</span>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add staff account">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Full name" error={form.formState.errors.fullName?.message}>
            <input {...form.register("fullName")} placeholder="e.g. Ali Raza" className="input" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <input
              {...form.register("email")}
              type="email"
              placeholder="cashier@example.com"
              className="input"
            />
          </Field>
          <Field
            label="Temporary password"
            error={form.formState.errors.password?.message}
            hint="Share this with them — no email confirmation is required."
          >
            <input
              {...form.register("password")}
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="input"
            />
          </Field>
          <Field label="Role" error={form.formState.errors.role?.message}>
            <select {...form.register("role")} className="input">
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
