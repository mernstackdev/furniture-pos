import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { SalesClient } from "@/components/SalesClient";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  salesCategoriesQuery,
  salesCustomersQuery,
  salesProductsQuery,
} from "@/lib/queries/sales";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function SalesPage() {
  const user = await requirePermission("sales.view");

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // Nothing in this render reads these values, so prefetch (not fetch) is
  // enough: the till hydrates from the dehydrated cache without a browser
  // round trip of its own.
  await Promise.all([
    queryClient.prefetchQuery(salesProductsQuery(supabase)),
    queryClient.prefetchQuery(salesCustomersQuery(supabase)),
    queryClient.prefetchQuery(salesCategoriesQuery(supabase)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SalesClient
        canSell={hasPermission(user, "sales.manage")}
        canAddCustomer={hasPermission(user, "customers.manage")}
      />
    </HydrationBoundary>
  );
}
