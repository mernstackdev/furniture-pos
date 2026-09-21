"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { setRolePermission } from "@/app/(pos)/users/actions";

export interface PermissionRow {
  key: string;
  description: string;
}

/**
 * Roles x permissions matrix.
 *
 * Checkboxes are driven by the server-rendered grants rather than local state,
 * so what is displayed always matches the database; the action revalidates the
 * page once the write lands.
 */
export function PermissionsCard({
  roles,
  permissions,
  grants,
  canManage,
}: {
  roles: string[];
  permissions: PermissionRow[];
  grants: Record<string, string[]>;
  canManage: boolean;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function toggle(role: string, permission: string, granted: boolean) {
    startTransition(async () => {
      const result = await setRolePermission(role, permission, granted);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          granted
            ? `${role} can now ${permission.split(".")[1]} ${permission.split(".")[0]}.`
            : `${role} can no longer ${permission.split(".")[1]} ${permission.split(".")[0]}.`
        );
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Permissions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What each role may do. Changes apply the moment the affected user acts — no
        re-login needed.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Permission</th>
              {roles.map((role) => (
                <th key={role} className="px-4 py-2 text-center font-medium capitalize">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key} className="border-b border-border last:border-0">
                <td className="py-3 pr-4">
                  <div className="font-medium text-foreground">{permission.key}</div>
                  <div className="text-xs text-muted-foreground">{permission.description}</div>
                </td>
                {roles.map((role) => {
                  const checked = (grants[role] ?? []).includes(permission.key);
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        checked={checked}
                        disabled={!canManage || pending}
                        aria-label={`${permission.key} for ${role}`}
                        onChange={(event) =>
                          toggle(role, permission.key, event.target.checked)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
