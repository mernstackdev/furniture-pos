import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { StockManager } from "@/components/StockManager";
import { hasPermission, requirePermission } from "@/lib/auth";
import { stockMovementsQuery, stockProductsQuery } from "@/lib/queries/stock";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function StockPage() {
  const user = await requirePermission("inventory.view");

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(stockProductsQuery(supabase)),
    queryClient.prefetchQuery(stockMovementsQuery(supabase)),
  ]);

  return (
    <div>
      <TopBar title="Stock Management" description="Track stock levels and record stock movements" />
      <div className="p-4 sm:p-8">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <StockManager canManage={hasPermission(user, "inventory.manage")} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
