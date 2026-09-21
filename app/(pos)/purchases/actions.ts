"use server";

import { revalidatePath } from "next/cache";
import { formString } from "@/lib/form";
import { authorizeInventory, friendlyError } from "@/lib/authorize";
import { toPurchaseItemsPayload } from "@/lib/inventory";
import { firstIssue, purchaseOrderSchema } from "@/lib/validation";

export interface PurchaseState {
  error: string | null;
  message: string | null;
}

function revalidateAll() {
  revalidatePath("/purchases");
  revalidatePath("/vendors");
  revalidatePath("/stock");
  revalidatePath("/inventory");
  revalidatePath("/");
}

/**
 * The order and its lines are created by one RPC so a half-written purchase is
 * impossible.
 */
export async function createPurchaseOrder(
  _previous: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  let items: unknown;
  try {
    items = JSON.parse(formString(formData, "items") || "[]");
  } catch {
    return { error: "Could not read the order lines.", message: null };
  }

  const parsed = purchaseOrderSchema.safeParse({
    vendorId: formString(formData, "vendorId"),
    reference: formString(formData, "reference") || undefined,
    notes: formString(formData, "notes") || undefined,
    items,
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const { error } = await supabase.rpc("create_purchase_order", {
    p_vendor_id: parsed.data.vendorId,
    p_reference: parsed.data.reference ?? "",
    p_notes: parsed.data.notes ?? "",
    // The RPC expects snake_case keys; see toPurchaseItemsPayload.
    p_items: toPurchaseItemsPayload(parsed.data.items),
  });

  if (error) return { error: friendlyError(error), message: null };

  revalidateAll();
  return { error: null, message: "Purchase order created." };
}

export async function receivePurchaseOrder(
  _previous: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  if (!id) return { error: "Missing purchase order.", message: null };

  const { error } = await supabase.rpc("receive_purchase_order", {
    p_purchase_order_id: id,
  });

  if (error) return { error: friendlyError(error), message: null };

  revalidateAll();
  return { error: null, message: "Stock received and levels updated." };
}

/** Cancelling keeps the record rather than deleting it, so the history stands. */
export async function cancelPurchaseOrder(
  _previous: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  if (!id) return { error: "Missing purchase order.", message: null };

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return { error: friendlyError(error), message: null };

  revalidateAll();
  return { error: null, message: "Purchase order cancelled." };
}
