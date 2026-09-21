import { cookies } from "next/headers";
import { DashboardClient } from "@/components/DashboardClient";
import { requireUser } from "@/lib/auth";
import { mapProduct, PRODUCT_SELECT } from "@/lib/inventory";
import { mapSale, SALE_SELECT, type SaleRow } from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

/** Everything on the dashboard is now read from Postgres. */
export default async function DashboardPage() {
  await requireUser();

  const supabase = createClient(await cookies());

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    { data: productRows },
    { count: customerCount },
    { data: todayRows },
    { data: recentRows },
  ] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).order("name", { ascending: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("sales")
      .select("total")
      .gte("sold_at", startOfToday.toISOString()),
    supabase
      .from("sales")
      .select(SALE_SELECT)
      .order("sold_at", { ascending: false })
      .limit(5),
  ]);

  const products = (productRows ?? []).map(mapProduct);
  const lowStock = products.filter(
    (product) => product.stockQty > 0 && product.stockQty <= product.lowStockThreshold
  );
  const outOfStock = products.filter((product) => product.stockQty === 0);

  const todaysSales = todayRows ?? [];
  const todaysRevenue = todaysSales.reduce((sum, row) => sum + Number(row.total), 0);

  const recentSales: SaleRow[] = (recentRows ?? []).map(mapSale);

  return (
    <DashboardClient
      totalProducts={products.length}
      lowStockCount={lowStock.length}
      outOfStockCount={outOfStock.length}
      customerCount={customerCount ?? 0}
      alerts={[...outOfStock, ...lowStock]}
      todaysRevenue={todaysRevenue}
      todaysSaleCount={todaysSales.length}
      recentSales={recentSales}
    />
  );
}
