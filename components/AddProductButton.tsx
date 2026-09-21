"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/components/ProductForm";
import { createProduct } from "@/app/(pos)/inventory/actions";
import { INVENTORY_QUERY_KEY } from "@/lib/queries/inventory";
import type { Category } from "@/lib/inventory";

/**
 * Lives in the page's top bar so the body keeps its full height for filters and
 * the table. Shares ProductForm with the edit dialog in InventoryManager.
 */
export function AddProductButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {/* Shorter on phones so the page title has room. */}
        + Add<span className="hidden sm:inline"> product</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add product">
        <ProductForm
          categories={categories}
          action={createProduct}
          onDone={() => {
            // The new product also changes the paged list, which is cached in
            // the browser; revalidatePath alone would leave it stale.
            queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
