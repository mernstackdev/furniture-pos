import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm";
import { hasPermission, requirePermission } from "@/lib/auth";
import { purchaseProductsQuery } from "@/lib/queries/purchases";
import { vendorOptionsQuery } from "@/lib/queries/vendors";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function NewPurchaseOrderPage() {
  const user = await requirePermission("inventory.view");

  // Only someone who can actually create a purchase needs the form.
  if (!hasPermission(user, "inventory.manage")) {
    redirect("/purchases");
  }

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(vendorOptionsQuery(supabase)),
    queryClient.prefetchQuery(purchaseProductsQuery(supabase)),
  ]);

  return (
    <div>
      <TopBar
        title="New purchase order"
        description="Order stock from a vendor and receive it into inventory"
        action={
          <Link
            href="/purchases"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
          >
            ← Back<span className="hidden sm:inline"> to purchases</span>
          </Link>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Steps make the flow obvious: raise it here, receive it later. */}
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <li className="font-medium text-accent">1. Enter the order</li>
            <li aria-hidden="true">→</li>
            <li>2. Save it as ordered</li>
            <li aria-hidden="true">→</li>
            <li>3. Receive it to add the stock</li>
          </ol>

          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <HydrationBoundary state={dehydrate(queryClient)}>
              <PurchaseOrderForm />
            </HydrationBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
