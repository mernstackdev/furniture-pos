"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { formNumber, formString } from "@/lib/form";
import { getSessionUser } from "@/lib/auth";
import { categoryNameSchema, firstIssue, productSchema } from "@/lib/validation";
import type { Category } from "@/lib/inventory";

export interface InventoryState {
  error: string | null;
  message: string | null;
}

const DENIED = "You don't have permission to change inventory.";

/**
 * Every action re-checks the caller. Proxy does not cover Server Actions, and
 * the database policies are the real gate — this only produces a clearer
 * message than a rejected query would.
 */
async function authorize() {
  const user = await getSessionUser();
  if (!user) return { supabase: null, error: "You are not signed in." };
  if (!user.permissions.includes("inventory.manage")) return { supabase: null, error: DENIED };
  return { supabase: createClient(await cookies()), error: null };
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That SKU is already used by another product.";
  if (error.code === "42501") return DENIED;
  return error.message;
}

/** The form posts strings; the shared schema wants numbers. */
function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    categoryId: formString(formData, "categoryId"),
    name: formString(formData, "name"),
    sku: formString(formData, "sku"),
    unit: formString(formData, "unit"),
    costPrice: formNumber(formData, "costPrice"),
    sellPrice: formNumber(formData, "sellPrice"),
    stockQty: formNumber(formData, "stockQty"),
    lowStockThreshold: formNumber(formData, "lowStockThreshold"),
    reorderPoint: formNumber(formData, "reorderPoint"),
  });
}

export async function createProduct(
  _previous: InventoryState,
  formData: FormData
): Promise<InventoryState> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied, message: null };

  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const values = parsed.data;
  const { error } = await supabase.from("products").insert({
    category_id: values.categoryId,
    name: values.name,
    sku: values.sku,
    unit: values.unit,
    cost_price: values.costPrice,
    sell_price: values.sellPrice,
    stock_qty: values.stockQty,
    low_stock_threshold: values.lowStockThreshold,
    reorder_point: values.reorderPoint,
  });

  if (error) return { error: friendly(error), message: null };

  revalidatePath("/inventory");
  revalidatePath("/stock");
  revalidatePath("/");
  return { error: null, message: `${values.name} added to inventory.` };
}

export async function updateProduct(
  _previous: InventoryState,
  formData: FormData
): Promise<InventoryState> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  if (!id) return { error: "Missing product.", message: null };

  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null };

  const values = parsed.data;
  const { error } = await supabase
    .from("products")
    .update({
      category_id: values.categoryId,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      cost_price: values.costPrice,
      sell_price: values.sellPrice,
      stock_qty: values.stockQty,
      low_stock_threshold: values.lowStockThreshold,
      reorder_point: values.reorderPoint,
    })
    .eq("id", id);

  if (error) return { error: friendly(error), message: null };

  revalidatePath("/inventory");
  revalidatePath("/stock");
  revalidatePath("/");
  return { error: null, message: `${values.name} updated.` };
}

export async function deleteProduct(
  _previous: InventoryState,
  formData: FormData
): Promise<InventoryState> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied, message: null };

  const id = formString(formData, "id");
  const label = formString(formData, "label") || "Product";
  if (!id) return { error: "Missing product.", message: null };

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: friendly(error), message: null };

  revalidatePath("/inventory");
  revalidatePath("/stock");
  revalidatePath("/");
  return { error: null, message: `${label} deleted.` };
}

/**
 * Called directly from the category combobox rather than as a form action, and
 * returns the category so the picker can select it immediately.
 */
export async function createCategory(
  name: string
): Promise<{ category: Category } | { error: string }> {
  const { supabase, error: denied } = await authorize();
  if (!supabase) return { error: denied ?? "Not allowed." };

  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data, error } = await supabase.rpc("get_or_create_category", {
    p_name: parsed.data,
  });

  if (error || !data) {
    return { error: friendly(error ?? { message: "Could not create category." }) };
  }

  revalidatePath("/inventory");
  return { category: { id: data as string, name: parsed.data } };
}
