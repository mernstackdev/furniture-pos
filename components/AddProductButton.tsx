"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/components/ProductForm";
import { createProduct } from "@/app/(pos)/inventory/actions";
import type { Category } from "@/lib/inventory";

/**
 * Lives in the page's top bar so the body keeps its full height for filters and
 * the table. Shares ProductForm with the edit dialog in InventoryManager.
 */
export function AddProductButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);

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
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
