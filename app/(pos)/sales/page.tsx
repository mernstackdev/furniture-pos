import { cookies } from "next/headers";
import { SalesClient } from "@/components/SalesClient";
import { hasPermission, requirePermission } from "@/lib/auth";
import { mapProduct, PRODUCT_SELECT, type Category } from "@/lib/inventory";
import { CUSTOMER_SELECT, mapCustomer } from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

export default async function SalesPage() {
  const user = await requirePermission("sales.view");

  const supabase = createClient(await cookies());
  const [{ data: productRows }, { data: customerRows }, { data: categoryRows }] =
    await Promise.all([
      supabase.from("products").select(PRODUCT_SELECT).order("name", { ascending: true }),
      supabase.from("customers").select(CUSTOMER_SELECT).order("name", { ascending: true }),
      supabase.from("categories").select("id, name").order("name", { ascending: true }),
    ]);

  const categories: Category[] = (categoryRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));

  return (
    <SalesClient
      products={(productRows ?? []).map(mapProduct)}
      customers={(customerRows ?? []).map(mapCustomer)}
      categories={categories}
      canSell={hasPermission(user, "sales.manage")}
      canAddCustomer={hasPermission(user, "customers.manage")}
    />
  );
}
