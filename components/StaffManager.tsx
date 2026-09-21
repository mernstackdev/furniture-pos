"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  CardActions,
  CardField,
  CardFields,
  CardHeading,
  ResponsiveList,
} from "@/components/ui/ResponsiveList";
import { useActionToast } from "@/components/ui/Toast";
import { staffAction, type StaffState } from "@/app/(pos)/users/actions";
import { formatDate } from "@/lib/format";
import { passwordResetSchema, type PasswordResetValues } from "@/lib/validation";

export interface StaffMember {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "cashier";
  createdAt: string;
}

const initialState: StaffState = { error: null, message: null };

export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: StaffMember[];
  currentUserId: string;
}) {
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const resetForm = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "" },
  });

  // The dialogs are dismissed from inside the action wrapper rather than from an
  // effect: syncing state in an effect cascades renders.
  const [actionState, actionDispatch, actionPending] = useActionState(
    async (previous: StaffState, formData: FormData) => {
      const result = await staffAction(previous, formData);
      if (result.message) {
        const intent = formData.get("intent");
        if (intent === "resetPassword") {
          setResetTarget(null);
          resetForm.reset();
        }
        if (intent === "delete") setDeleteTarget(null);
      }
      return result;
    },
    initialState
  );

  useActionToast(actionState);

  const submitReset = resetForm.handleSubmit((values) => {
    if (!resetTarget) return;
    const formData = new FormData();
    formData.set("intent", "resetPassword");
    formData.set("userId", resetTarget.id);
    formData.set("password", values.password);
    startTransition(() => actionDispatch(formData));
  });

  function confirmDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("userId", deleteTarget.id);
    actionDispatch(formData);
  }

  const roleLabel = (member: StaffMember) =>
    member.id === currentUserId ? `${member.role} (you)` : member.role;

  function actions(member: StaffMember) {
    return (
      <CardActions>
        <Button variant="secondary" className="flex-1" onClick={() => setResetTarget(member)}>
          Reset password
        </Button>
        <Button
          variant="danger"
          onClick={() => setDeleteTarget(member)}
          // The database refuses this too; it just avoids a pointless round trip.
          disabled={member.id === currentUserId}
        >
          Delete
        </Button>
      </CardActions>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">
        Staff accounts
        <span className="ml-2 font-normal text-muted-foreground">
          {staff.length} {staff.length === 1 ? "account" : "accounts"}
        </span>
      </h2>

      <ResponsiveList
        rows={staff}
        rowKey={(member) => member.id}
        emptyMessage="No staff accounts yet."
        card={(member) => (
          <>
            <CardHeading
              title={member.fullName || member.email}
              subtitle={member.email}
              badge={
                <Badge tone={member.role === "admin" ? "success" : "neutral"}>
                  {roleLabel(member)}
                </Badge>
              }
            />
            <CardFields>
              <CardField label="Added">{formatDate(member.createdAt)}</CardField>
            </CardFields>
            {actions(member)}
          </>
        )}
        columns={[
          {
            header: "Name",
            render: (member) => (
              <div>
                <div className="font-medium text-foreground">
                  {member.fullName || "—"}
                  {member.id === currentUserId ? (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{member.email}</div>
              </div>
            ),
          },
          {
            header: "Role",
            render: (member) => (
              <form action={actionDispatch}>
                <input type="hidden" name="intent" value="setRole" />
                <input type="hidden" name="userId" value={member.id} />
                <select
                  name="role"
                  defaultValue={member.role}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="input max-w-[8rem]"
                  aria-label={`Role for ${member.fullName || member.email}`}
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </form>
            ),
          },
          {
            header: "Status",
            render: (member) => (
              <Badge tone={member.role === "admin" ? "success" : "neutral"}>
                {member.role}
              </Badge>
            ),
          },
          {
            header: "Added",
            render: (member) => (
              <span className="text-muted-foreground">{formatDate(member.createdAt)}</span>
            ),
          },
          {
            header: "Actions",
            render: (member) => (
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setResetTarget(member)}>
                  Reset password
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleteTarget(member)}
                  disabled={member.id === currentUserId}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        title="Reset password"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Set a new password for{" "}
          <span className="font-medium text-foreground">
            {resetTarget?.fullName || resetTarget?.email}
          </span>
          .
        </p>
        <form onSubmit={submitReset} className="space-y-4" noValidate>
          <Field label="New password" error={resetForm.formState.errors.password?.message}>
            <input
              {...resetForm.register("password")}
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="input"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="submit">Reset password</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete staff account"
        pending={actionPending}
        message={
          <>
            Delete{" "}
            <span className="font-medium text-foreground">
              {deleteTarget?.fullName || deleteTarget?.email}
            </span>
            ? They will lose access immediately and this cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
