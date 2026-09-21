"use client";

import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Confirmation dialog. Replaces window.confirm, which cannot be styled, blocks
 * the event loop, and is suppressed outright in some browsers.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
