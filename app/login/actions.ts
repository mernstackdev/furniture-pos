"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { firstIssue, signInSchema } from "@/lib/validation";

export interface SignInState {
  error: string | null;
}

export async function signIn(
  _previous: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formString(formData, "email").trim(),
    password: formString(formData, "password"),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: don't reveal whether the account exists.
    return { error: "Invalid email or password." };
  }

  // Must sit outside any try/catch: redirect() signals by throwing.
  redirect("/");
}
