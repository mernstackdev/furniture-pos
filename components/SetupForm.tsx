"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createFirstAdmin, type SetupState } from "@/app/setup/actions";
import { setupSchema, type SetupValues } from "@/lib/validation";

const initialState: SetupState = { error: null };

export function SetupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const [state, formAction, pending] = useActionState(createFirstAdmin, initialState);

  function onSubmit(values: SetupValues) {
    const formData = new FormData();
    formData.set("fullName", values.fullName);
    formData.set("email", values.email);
    formData.set("password", values.password);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
      <Field label="Full name" error={errors.fullName?.message}>
        <input
          {...register("fullName")}
          placeholder="e.g. Khizar Hayat"
          autoComplete="name"
          autoFocus
          className="input"
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="input"
        />
      </Field>

      <Field
        label="Password"
        error={errors.password?.message}
        hint="At least 6 characters. You can change it later from your profile."
      >
        <input
          {...register("password")}
          type="password"
          placeholder="At least 6 characters"
          autoComplete="new-password"
          className="input"
        />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create administrator"}
      </Button>
    </form>
  );
}
