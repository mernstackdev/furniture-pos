import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { AddStaffButton } from "@/components/AddStaffButton";
import { PermissionsCard } from "@/components/PermissionsCard";
import { StaffManager } from "@/components/StaffManager";
import { hasPermission, requireAdmin } from "@/lib/auth";
import {
  permissionCatalogQuery,
  roleGrantsQuery,
  staffListQuery,
} from "@/lib/queries/staff";
import { makeQueryClient } from "@/lib/queryClient";
import { createClient } from "@/utils/supabase/server";

export default async function UsersPage() {
  // Admin-only. Hiding the sidebar link is not enough: hitting /users directly
  // must not render for a cashier.
  const admin = await requireAdmin();

  const supabase = createClient(await cookies());
  // A per-request cache that exists only to be handed to the browser.
  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(staffListQuery(supabase)),
    queryClient.prefetchQuery(permissionCatalogQuery(supabase)),
    queryClient.prefetchQuery(roleGrantsQuery(supabase)),
  ]);

  return (
    <div>
      <TopBar
        title="Staff"
        description="Create accounts, manage roles and permissions"
        action={hasPermission(admin, "staff.manage") ? <AddStaffButton /> : undefined}
      />
      <div className="space-y-6 p-4 sm:p-8">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <StaffManager currentUserId={admin.id} />
          <PermissionsCard canManage={hasPermission(admin, "staff.manage")} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
