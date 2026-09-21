import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DashboardClient } from "@/components/DashboardClient";
import { requireUser } from "@/lib/auth";
import {
  dashboardCustomerCountQuery,
  dashboardProductsQuery,
  dashboardRecentSalesQuery,
  dashboardTodaySalesQuery,
} from "@/lib/queries/dashboard";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

/** Everything on the dashboard is now read from Postgres. */
export default async function DashboardPage() {
  await requireUser();

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // No render-time decision depends on these, so prefetchQuery is enough: the
  // panel renders straight from the dehydrated cache without a browser fetch.
  await Promise.all([
    queryClient.prefetchQuery(dashboardProductsQuery(supabase)),
    queryClient.prefetchQuery(dashboardCustomerCountQuery(supabase)),
    queryClient.prefetchQuery(dashboardTodaySalesQuery(supabase)),
    queryClient.prefetchQuery(dashboardRecentSalesQuery(supabase)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
