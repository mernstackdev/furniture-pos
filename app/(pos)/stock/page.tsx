import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { StockManager } from "@/components/StockManager";
import { hasPermission, requirePermission } from "@/lib/auth";
import { mapMovement, mapProduct, MOVEMENT_SELECT, PRODUCT_SELECT } from "@/lib/inventory";
import { createClient } from "@/utils/supabase/server";

export default async function StockPage() {
  const user = await requirePermission("inventory.view");

  const supabase = createClient(await cookies());
  const [{ data: productRows }, { data: movementRows }] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select(MOVEMENT_SELECT)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const products = (productRows ?? []).map(mapProduct);
  const movements = (movementRows ?? []).map(mapMovement);

  // At or below the reorder point, and not already at zero — out-of-stock items
  // are called out separately by the status badge.
  const restock = products.filter(
    (product) => product.stockQty > 0 && product.stockQty <= product.reorderPoint
  );

  return (
    <div>
      <TopBar title="Stock Management" description="Track stock levels and record stock movements" />
      <div className="p-4 sm:p-8">
        <StockManager
          products={products}
          movements={movements}
          restock={restock}
          canManage={hasPermission(user, "inventory.manage")}
        />
      </div>
    </div>
  );
}
