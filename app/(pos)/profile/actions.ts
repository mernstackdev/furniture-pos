"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { getSessionUser } from "@/lib/auth";
import { firstIssue, passwordChangeSchema, profileNameSchema } from "@/lib/validation";

export interface ProfileState {
  error: string | null;
  message: string | null;
}

/**
 * Both actions re-resolve the session themselves. Proxy does not see Server
 * Actions as distinct routes, so it cannot be relied on to gate them.
 */
export async function updateFullName(
  _previous: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in.", message: null };

  const parsed = profileNameSchema.safeParse({
    fullName: formString(formData, "fullName"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const supabase = createClient(await cookies());

  // Only `full_name` is writable here: the protect_profile_columns trigger
  // rejects any attempt to change role or email from an authenticated session.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);

  if (error) return { error: error.message, message: null };

  // Refresh the layout so the sidebar picks up the new name.
  revalidatePath("/", "layout");
  return { error: null, message: "Name updated." };
}

export async function updatePassword(
  _previous: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in.", message: null };

  const parsed = passwordChangeSchema.safeParse({
    password: formString(formData, "password"),
    confirm: formString(formData, "confirm"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: error.message, message: null };

  return { error: null, message: "Password updated." };
}
