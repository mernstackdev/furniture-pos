"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VendorForm } from "@/components/VendorForm";

/**
 * Lives in the page's top bar so the body keeps its height for filters and the
 * table. Shares VendorForm with the edit dialog in VendorsManager.
 */
export function AddVendorButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add<span className="hidden sm:inline"> vendor</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add vendor">
        <VendorForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}
