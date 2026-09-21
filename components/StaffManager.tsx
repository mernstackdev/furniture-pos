"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
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
import { staffAction, type StaffState } from "@/app/(pos)/users/actions";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { useServerAction, withoutPrevious } from "@/lib/queries/mutation";
import { staffListQuery, STAFF_QUERY_KEY, type StaffMember } from "@/lib/queries/staff";
import { formatDate } from "@/lib/format";
import { passwordResetSchema, type PasswordResetValues } from "@/lib/validation";

const initialState: StaffState = { error: null, message: null };

export function StaffManager({ currentUserId }: { currentUserId: string }) {
  const supabase = useSupabaseBrowser();
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  // Prefetched and hydrated by the page, so the first render reads the cache.
  const { data, isPending } = useQuery(staffListQuery(supabase));
  const staff = data ?? [];

  const resetForm = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "" },
  });

  // One action carries an `intent` and serves all three writes. Each intent
  // gets its own mutation so it can own the right success side effect (close
  // which dialog, reset which form) — the shared action still does the write,
  // and each one refreshes the staff key so the list reflects it.
  const roleMutation = useServerAction({
    action: withoutPrevious(staffAction, initialState),
    invalidate: [STAFF_QUERY_KEY],
  });

  const resetMutation = useServerAction({
    action: withoutPrevious(staffAction, initialState),
    invalidate: [STAFF_QUERY_KEY],
    onSuccess: () => {
      setResetTarget(null);
      resetForm.reset();
    },
  });

  const deleteMutation = useServerAction({
    action: withoutPrevious(staffAction, initialState),
    invalidate: [STAFF_QUERY_KEY],
    onSuccess: () => setDeleteTarget(null),
  });

  const submitReset = resetForm.handleSubmit((values) => {
    if (!resetTarget) return;
    const formData = new FormData();
    formData.set("intent", "resetPassword");
    formData.set("userId", resetTarget.id);
    formData.set("password", values.password);
    resetMutation.mutate(formData);
  });

  function confirmDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("userId", deleteTarget.id);
    deleteMutation.mutate(formData);
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
        emptyMessage={isPending ? "Loading staff accounts…" : "No staff accounts yet."}
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
              <form action={roleMutation.mutate}>
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
        pending={deleteMutation.isPending}
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
