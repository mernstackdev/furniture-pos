import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { InvoicePrint } from "@/components/InvoicePrint";
import { requirePermission } from "@/lib/auth";
import {
  mapSale,
  mapSaleItem,
  SALE_ITEM_SELECT,
  SALE_SELECT,
} from "@/lib/sales";
import { createClient } from "@/utils/supabase/server";

export default async function InvoiceDetailPage(props: PageProps<"/invoices/[id]">) {
  await requirePermission("sales.view");
  const { id } = await props.params;

  const supabase = createClient(await cookies());
  const { data: saleRow } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!saleRow) notFound();

  const sale = mapSale(saleRow);

  const [{ data: itemRows }, { data: customerRow }] = await Promise.all([
    supabase.from("sale_items").select(SALE_ITEM_SELECT).eq("sale_id", id),
    sale.customerId
      ? supabase
          .from("customers")
          .select("phone, address")
          .eq("id", sale.customerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <InvoicePrint
      sale={sale}
      items={(itemRows ?? []).map(mapSaleItem)}
      customerPhone={(customerRow?.phone as string) ?? null}
      customerAddress={(customerRow?.address as string) ?? null}
    />
  );
}
