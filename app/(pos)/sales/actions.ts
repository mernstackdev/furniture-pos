"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { customerSchema, firstIssue, saleSchema, type SaleValues } from "@/lib/validation";
import { CUSTOMER_SELECT, mapCustomer, type Customer } from "@/lib/sales";

const CUSTOMERS_DENIED = "You don't have permission to add customers.";

const DENIED = "You don't have permission to record sales.";

/**
 * Called directly by the till rather than as a form action, so it can return
 * the new sale id for navigation.
 *
 * The RPC does the real work — pricing, stock check, deduction and movements —
 * in one transaction. It reads prices from the catalogue, so nothing here
 * trusts a figure supplied by the browser.
 */
export async function recordSale(
  input: SaleValues
): Promise<{ id: string } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };
  if (!user.permissions.includes("sales.manage")) return { error: DENIED };

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = createClient(await cookies());

  const { data, error } = await supabase.rpc("create_sale", {
    p_customer_id: parsed.data.customerId,
    // The RPC reads snake_case keys; sending camelCase gave a NULL product_id
    // the last time this boundary was crossed.
    p_items: parsed.data.items.map((item) => ({
      product_id: item.productId,
      qty: item.qty,
    })),
    p_discount: parsed.data.discount,
    p_payment_method: parsed.data.paymentMethod,
    p_status: parsed.data.status,
  });

  if (error || !data) {
    return { error: error?.code === "42501" ? DENIED : error?.message ?? "Could not record the sale." };
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/stock");
  revalidatePath("/customers");
  return { id: data as string };
}

/**
 * Adds a customer from the till, returning them so the cart can select the new
 * record immediately. Validation is the same customerSchema the customers
 * screen uses — only the return shape differs, because the caller needs the id.
 */
export async function createCustomerForSale(input: {
  name: string;
  phone: string;
  address: string;
}): Promise<{ customer: Customer } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };
  if (!user.permissions.includes("customers.manage")) return { error: CUSTOMERS_DENIED };

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("customers")
    .insert(parsed.data)
    .select(CUSTOMER_SELECT)
    .single();

  if (error || !data) {
    return {
      error:
        error?.code === "42501" ? CUSTOMERS_DENIED : error?.message ?? "Could not add the customer.",
    };
  }

  revalidatePath("/customers");
  return { customer: mapCustomer(data) };
}
