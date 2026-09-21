"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { firstIssue, setupSchema } from "@/lib/validation";

export interface SetupState {
  error: string | null;
}

/**
 * Creates the very first admin. The database function refuses to run once any
 * profile exists, so this is safe to expose publicly — the guard does not rely
 * on this action or on Proxy.
 */
export async function createFirstAdmin(
  _previous: SetupState,
  formData: FormData
): Promise<SetupState> {
  const parsed = setupSchema.safeParse({
    fullName: formString(formData, "fullName").trim(),
    email: formString(formData, "email").trim(),
    password: formString(formData, "password"),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { email, password, fullName } = parsed.data;
  const supabase = createClient(await cookies());

  const { error } = await supabase.rpc("create_first_admin", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
  });

  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Setup has already been completed. Please sign in."
          : error.message,
    };
  }

  // Sign the new admin straight in rather than bouncing them to the login form.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Account created, but sign-in failed. Try signing in manually." };
  }

  redirect("/");
}
