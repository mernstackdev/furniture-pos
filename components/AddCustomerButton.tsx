"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "@/components/CustomerForm";
import { saveCustomer } from "@/app/(pos)/customers/actions";

/** Lives in the page's top bar so the list keeps the body to itself. */
export function AddCustomerButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add<span className="hidden sm:inline"> customer</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add customer">
        <CustomerForm
          action={saveCustomer}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
