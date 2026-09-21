"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formNumber, formString } from "@/lib/form";
import { getSessionUser } from "@/lib/auth";
import { firstIssue, stockAdjustSchema } from "@/lib/validation";

export interface StockState {
  error: string | null;
  message: string | null;
}

const DENIED = "You don't have permission to adjust stock.";

export async function adjustStock(
  _previous: StockState,
  formData: FormData
): Promise<StockState> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in.", message: null };
  if (!user.permissions.includes("inventory.manage")) return { error: DENIED, message: null };

  const parsed = stockAdjustSchema.safeParse({
    productId: formString(formData, "productId"),
    type: formString(formData, "type"),
    qty: formNumber(formData, "qty"),
    reason: formString(formData, "reason") || undefined,
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const supabase = createClient(await cookies());

  // The RPC writes the ledger row and the new stock level together.
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: parsed.data.productId,
    p_type: parsed.data.type,
    p_qty: parsed.data.qty,
    p_reason: parsed.data.reason ?? "",
  });

  if (error) {
    return { error: error.code === "42501" ? DENIED : error.message, message: null };
  }

  revalidatePath("/stock");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { error: null, message: `Stock updated to ${data}.` };
}
