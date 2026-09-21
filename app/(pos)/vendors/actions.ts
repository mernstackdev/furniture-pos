"use server";

import { revalidatePath } from "next/cache";
import { formNumber, formString } from "@/lib/form";
import { authorizeInventory, friendlyError } from "@/lib/authorize";
import { formatPKR } from "@/lib/format";
import { firstIssue, vendorPaymentSchema, vendorSchema } from "@/lib/validation";

export interface VendorState {
  error: string | null;
  message: string | null;
}

function parse(formData: FormData) {
  return vendorSchema.safeParse({
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    city: formString(formData, "city") || undefined,
    address: formString(formData, "address") || undefined,
    notes: formString(formData, "notes") || undefined,
  });
}

export async function saveVendor(
  _previous: VendorState,
  formData: FormData
): Promise<VendorState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const parsed = parse(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const id = formString(formData, "id");
  const values = {
    name: parsed.data.name,
    phone: parsed.data.phone,
    city: parsed.data.city ?? "",
    address: parsed.data.address ?? "",
    notes: parsed.data.notes ?? "",
  };

  const { error } = id
    ? await supabase.from("vendors").update(values).eq("id", id)
    : await supabase.from("vendors").insert(values);

  if (error) return { error: friendlyError(error), message: null };

  revalidatePath("/vendors");
  revalidatePath("/purchases");
  return {
    error: null,
    message: id ? `${values.name} updated.` : `${values.name} added.`,
  };
}

export async function deleteVendor(
  _previous: VendorState,
  formData: FormData
): Promise<VendorState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  const label = formString(formData, "label") || "Vendor";
  if (!id) return { error: "Missing vendor.", message: null };

  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { error: friendlyError(error), message: null };

  revalidatePath("/vendors");
  return { error: null, message: `${label} removed.` };
}

/**
 * Records money paid to a vendor. Optionally settles a specific bill; leaving
 * it blank is a payment on account, which is how most of these shops clear a
 * running balance.
 */
export async function recordPayment(
  _previous: VendorState,
  formData: FormData
): Promise<VendorState> {
  const { supabase, error: denied, user } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const parsed = vendorPaymentSchema.safeParse({
    vendorId: formString(formData, "vendorId"),
    purchaseOrderId: formString(formData, "purchaseOrderId") || undefined,
    amount: formNumber(formData, "amount"),
    method: formString(formData, "method") || "cash",
    reference: formString(formData, "reference") || undefined,
    note: formString(formData, "note") || undefined,
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const { error } = await supabase.from("vendor_payments").insert({
    vendor_id: parsed.data.vendorId,
    purchase_order_id: parsed.data.purchaseOrderId || null,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? "",
    note: parsed.data.note ?? "",
    created_by: user?.id ?? null,
  });

  if (error) return { error: friendlyError(error), message: null };

  revalidatePath("/vendors");
  return { error: null, message: `Payment of ${formatPKR(parsed.data.amount)} recorded.` };
}

/** Payments get entered wrong; allowing removal is the correction path. */
export async function deletePayment(
  _previous: VendorState,
  formData: FormData
): Promise<VendorState> {
  const { supabase, error: denied } = await authorizeInventory();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  if (!id) return { error: "Missing payment.", message: null };

  const { error } = await supabase.from("vendor_payments").delete().eq("id", id);
  if (error) return { error: friendlyError(error), message: null };

  revalidatePath("/vendors");
  return { error: null, message: "Payment removed." };
}
