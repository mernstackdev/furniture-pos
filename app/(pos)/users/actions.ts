"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { getSessionUser, requireAdmin } from "@/lib/auth";
import {
  firstIssue,
  passwordResetSchema,
  staffCreateSchema,
} from "@/lib/validation";

export interface StaffState {
  error: string | null;
  message: string | null;
}

function isRole(value: string): value is "admin" | "cashier" {
  return value === "admin" || value === "cashier";
}

/**
 * Every action re-checks that the caller is an admin. Proxy is not a security
 * boundary for Server Actions, and hiding the Staff link is presentation only.
 *
 * The privileged work happens in SECURITY DEFINER database functions, so no
 * service/secret key exists in this runtime.
 */
export async function createUser(
  _previous: StaffState,
  formData: FormData
): Promise<StaffState> {
  await requireAdmin();

  const parsed = staffCreateSchema.safeParse({
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email").trim(),
    password: formString(formData, "password"),
    role: formString(formData, "role") || "cashier",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const { email, password, fullName, role } = parsed.data;
  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
  });

  if (error) return { error: error.message, message: null };

  revalidatePath("/users");
  return { error: null, message: `${fullName} can now sign in.` };
}

export async function staffAction(
  _previous: StaffState,
  formData: FormData
): Promise<StaffState> {
  await requireAdmin();

  const intent = String(formData.get("intent") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user.", message: null };

  const supabase = createClient(await cookies());

  if (intent === "setRole") {
    const role = String(formData.get("role") ?? "");
    if (!isRole(role)) return { error: "Unknown role.", message: null };

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) return { error: error.message, message: null };

    revalidatePath("/users");
    return {
      error: null,
      // The role claim lives in the JWT, so it only changes when their token
      // refreshes (next sign-in at the latest).
      message: "Role updated. It takes effect the next time that user signs in.",
    };
  }

  if (intent === "resetPassword") {
    const parsed = passwordResetSchema.safeParse({
      password: formString(formData, "password"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

    const { error } = await supabase.rpc("admin_reset_password", {
      p_user_id: userId,
      p_password: parsed.data.password,
    });

    if (error) return { error: error.message, message: null };
    return { error: null, message: "Password reset." };
  }

  if (intent === "delete") {
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
    if (error) return { error: error.message, message: null };

    revalidatePath("/users");
    return { error: null, message: "User deleted." };
  }

  return { error: "Unknown action.", message: null };
}

/**
 * Grants or revokes a permission for a role. Called directly by the permissions
 * matrix rather than as a form action.
 */
export async function setRolePermission(
  role: string,
  permissionKey: string,
  granted: boolean
): Promise<{ error: string | null }> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };
  if (!user.permissions.includes("staff.manage")) {
    return { error: "You don't have permission to change roles." };
  }
  if (!isRole(role)) return { error: "Unknown role." };

  const supabase = createClient(await cookies());

  if (granted) {
    const { error } = await supabase
      .from("role_permissions")
      .insert({ role, permission_key: permissionKey });
    // Already granted is not a failure worth surfacing.
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role", role)
      .eq("permission_key", permissionKey);
    if (error) return { error: error.message };
  }

  revalidatePath("/users");
  revalidatePath("/inventory");
  revalidatePath("/stock");
  return { error: null };
}
