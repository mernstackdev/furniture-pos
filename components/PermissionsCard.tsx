"use client";

import { useQuery } from "@tanstack/react-query";
import { setRolePermission } from "@/app/(pos)/users/actions";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { useServerAction, type ActionResult } from "@/lib/queries/mutation";
import {
  permissionCatalogQuery,
  roleGrantsQuery,
  STAFF_QUERY_KEY,
  STAFF_ROLES,
  type PermissionRow,
} from "@/lib/queries/staff";

/**
 * Roles x permissions matrix.
 *
 * Checkboxes are driven by the query's grants rather than local state, so what
 * is displayed always matches the database; a toggle invalidates the staff key
 * so the matrix re-renders from the refreshed grants.
 */
export function PermissionsCard({ canManage }: { canManage: boolean }) {
  const supabase = useSupabaseBrowser();
  const { data: permissionData, isPending: permissionsPending } = useQuery(
    permissionCatalogQuery(supabase)
  );
  const { data: grantsData } = useQuery(roleGrantsQuery(supabase));

  const permissions: PermissionRow[] = permissionData ?? [];
  const grants: Record<string, string[]> = grantsData ?? {};

  // setRolePermission is a plain (role, key, granted) function, not a form
  // action, so the toggle's values are packed into FormData to reuse the shared
  // mutation helper — it owns the toast, the pending flag and the invalidation.
  // It returns `{ error }` with no `message`, so the success message is built
  // here to keep the original wording.
  const mutation = useServerAction({
    action: async (formData): Promise<ActionResult> => {
      const role = String(formData.get("role"));
      const permissionKey = String(formData.get("permissionKey"));
      const granted = formData.get("granted") === "true";

      const result = await setRolePermission(role, permissionKey, granted);
      if (result.error) return { error: result.error, message: null };

      const [subject, action = ""] = permissionKey.split(".");
      return {
        error: null,
        message: granted
          ? `${role} can now ${action} ${subject}.`
          : `${role} can no longer ${action} ${subject}.`,
      };
    },
    // Grants live under the staff key, so this refreshes the matrix itself.
    invalidate: [STAFF_QUERY_KEY],
  });

  function toggle(role: string, permission: string, granted: boolean) {
    const formData = new FormData();
    formData.set("role", role);
    formData.set("permissionKey", permission);
    formData.set("granted", granted ? "true" : "false");
    mutation.mutate(formData);
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
              {STAFF_ROLES.map((role) => (
                <th key={role} className="px-4 py-2 text-center font-medium capitalize">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 && permissionsPending ? (
              <tr>
                <td
                  colSpan={STAFF_ROLES.length + 1}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Loading permissions…
                </td>
              </tr>
            ) : (
              permissions.map((permission) => (
                <tr key={permission.key} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-foreground">{permission.key}</div>
                    <div className="text-xs text-muted-foreground">{permission.description}</div>
                  </td>
                  {STAFF_ROLES.map((role) => {
                    const checked = (grants[role] ?? []).includes(permission.key);
                    return (
                      <td key={role} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          checked={checked}
                          disabled={!canManage || mutation.isPending}
                          aria-label={`${permission.key} for ${role}`}
                          onChange={(event) =>
                            toggle(role, permission.key, event.target.checked)
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
