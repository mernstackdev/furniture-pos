"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useActionToast } from "@/components/ui/Toast";
import {
  updateFullName,
  updatePassword,
  type ProfileState,
} from "@/app/(pos)/profile/actions";
import {
  passwordChangeSchema,
  profileNameSchema,
  type PasswordChangeValues,
  type ProfileNameValues,
} from "@/lib/validation";

const initialState: ProfileState = { error: null, message: null };

export function ProfileForm({
  email,
  fullName,
  role,
}: {
  email: string;
  fullName: string;
  role: string;
}) {
  const nameForm = useForm<ProfileNameValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName },
  });

  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const [nameState, nameAction, namePending] = useActionState(updateFullName, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePassword,
    initialState
  );

  useActionToast(nameState);
  useActionToast(passwordState);

  const submitName = nameForm.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("fullName", values.fullName);
    startTransition(() => nameAction(formData));
  });

  const submitPassword = passwordForm.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("password", values.password);
    formData.set("confirm", values.confirm);
    startTransition(() => passwordAction(formData));
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <dl className="mt-3 grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate text-foreground">{email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize text-foreground">{role}</dd>
          </div>
        </dl>

        <form onSubmit={submitName} className="mt-4 space-y-4" noValidate>
          <Field label="Full name" error={nameForm.formState.errors.fullName?.message}>
            <input
              {...nameForm.register("fullName")}
              placeholder="e.g. Khizar Hayat"
              className="input"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={namePending}>
              {namePending ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Change password</h2>
        <form onSubmit={submitPassword} className="mt-4 space-y-4" noValidate>
          <Field label="New password" error={passwordForm.formState.errors.password?.message}>
            <input
              {...passwordForm.register("password")}
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="input"
            />
          </Field>
          <Field label="Confirm new password" error={passwordForm.formState.errors.confirm?.message}>
            <input
              {...passwordForm.register("confirm")}
              type="password"
              placeholder="Repeat the new password"
              autoComplete="new-password"
              className="input"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
