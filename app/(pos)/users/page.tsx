import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { AddStaffButton } from "@/components/AddStaffButton";
import { PermissionsCard, type PermissionRow } from "@/components/PermissionsCard";
import { StaffManager, type StaffMember } from "@/components/StaffManager";
import { hasPermission, requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

const ROLES = ["admin", "cashier"];

export default async function UsersPage() {
  // Admin-only. Hiding the sidebar link is not enough: hitting /users directly
  // must not render for a cashier.
  const admin = await requireAdmin();

  const supabase = createClient(await cookies());
  const [{ data }, { data: permissionRows }, { data: grantRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("permissions").select("key, description").order("key", { ascending: true }),
    supabase.from("role_permissions").select("role, permission_key"),
  ]);

  const staff: StaffMember[] = (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    fullName: row.full_name as string,
    role: row.role as "admin" | "cashier",
    createdAt: row.created_at as string,
  }));

  const permissions: PermissionRow[] = (permissionRows ?? []).map((row) => ({
    key: row.key as string,
    description: row.description as string,
  }));

  const grants: Record<string, string[]> = {};
  for (const role of ROLES) grants[role] = [];
  for (const row of grantRows ?? []) {
    const role = row.role as string;
    if (!grants[role]) grants[role] = [];
    grants[role].push(row.permission_key as string);
  }

  return (
    <div>
      <TopBar
        title="Staff"
        description="Create accounts, manage roles and permissions"
        action={hasPermission(admin, "staff.manage") ? <AddStaffButton /> : undefined}
      />
      <div className="space-y-6 p-4 sm:p-8">
        <StaffManager staff={staff} currentUserId={admin.id} />
        <PermissionsCard
          roles={ROLES}
          permissions={permissions}
          grants={grants}
          canManage={hasPermission(admin, "staff.manage")}
        />
      </div>
    </div>
  );
}
