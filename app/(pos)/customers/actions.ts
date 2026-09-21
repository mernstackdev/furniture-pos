"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { getSessionUser } from "@/lib/auth";
import { customerSchema, firstIssue } from "@/lib/validation";

export interface CustomerState {
  error: string | null;
  message: string | null;
}

const DENIED = "You don't have permission to change customers.";

/** Re-checked here: proxy does not cover Server Actions. */
async function authorize() {
  const user = await getSessionUser();
  if (!user) return { supabase: null, error: "You are not signed in." };
  if (!user.permissions.includes("customers.manage")) return { supabase: null, error: DENIED };
  return { supabase: createClient(await cookies()), error: null };
}

export async function saveCustomer(
  _previous: CustomerState,
  formData: FormData
): Promise<CustomerState> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied, message: null };

  const parsed = customerSchema.safeParse({
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    address: formString(formData, "address"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const id = formString(formData, "id");
  const { error } = id
    ? await supabase.from("customers").update(parsed.data).eq("id", id)
    : await supabase.from("customers").insert(parsed.data);

  if (error) {
    return {
      error: error.code === "42501" ? DENIED : error.message,
      message: null,
    };
  }

  revalidatePath("/customers");
  return {
    error: null,
    message: id ? `${parsed.data.name} updated.` : `${parsed.data.name} added.`,
  };
}

/**
 * Deleting a customer leaves their sales in place — the FK is `on delete set
 * null`, so those invoices simply become walk-ins, which is what the app did
 * before and what the UI already renders.
 */
export async function deleteCustomer(
  _previous: CustomerState,
  formData: FormData
): Promise<CustomerState> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  const label = formString(formData, "label") || "Customer";
  if (!id) return { error: "Missing customer.", message: null };

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { error: error.code === "42501" ? DENIED : error.message, message: null };

  revalidatePath("/customers");
  return { error: null, message: `${label} deleted. Their invoices are kept.` };
}
