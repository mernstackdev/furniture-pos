import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { InvoicePrint } from "@/components/InvoicePrint";
import { requirePermission } from "@/lib/auth";
import {
  invoiceCustomerQuery,
  invoiceItemsQuery,
  invoiceQuery,
} from "@/lib/queries/invoices";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function InvoiceDetailPage(props: PageProps<"/invoices/[id]">) {
  await requirePermission("sales.view");
  const { id } = await props.params;

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  // fetchQuery: a missing invoice is a 404, which has to resolve before render.
  const sale = await queryClient.fetchQuery(invoiceQuery(supabase, { id }));
  if (!sale) notFound();

  // The billing contact is looked up by the sale's customer id, so it can only
  // run once the sale is known; a walk-in has no customer to look up.
  await Promise.all([
    queryClient.fetchQuery(invoiceItemsQuery(supabase, { id })),
    sale.customerId
      ? queryClient.fetchQuery(
          invoiceCustomerQuery(supabase, { customerId: sale.customerId })
        )
      : Promise.resolve(null),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InvoicePrint id={id} />
    </HydrationBoundary>
  );
}
