"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formString } from "@/lib/form";
import { getSessionUser } from "@/lib/auth";

export interface InvoiceState {
  error: string | null;
  message: string | null;
}

/**
 * Sales cannot be deleted — voiding one would have to put the stock back — but
 * an unpaid invoice does need a way to be settled.
 */
export async function markSalePaid(
  formData: FormData
): Promise<{ error: string | null; message?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };
  if (!user.permissions.includes("sales.manage")) {
    return { error: "You don't have permission to change invoices." };
  }

  const id = formString(formData, "id");
  if (!id) return { error: "Missing invoice." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("sales").update({ status: "paid" }).eq("id", id);

  if (error) {
    return {
      error:
        error.code === "42501"
          ? "You don't have permission to change invoices."
          : error.message,
    };
  }

  revalidatePath("/invoices");
  revalidatePath("/customers");
  revalidatePath("/");
  return { error: null, message: "Invoice marked paid." };
}
