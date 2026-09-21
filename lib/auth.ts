import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type AppRole = "admin" | "cashier";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  /** Permission keys held by the user's role, e.g. "inventory.manage". */
  permissions: string[];
}

/**
 * Resolves the signed-in user from the verified JWT plus their profile row.
 * Returns null when there is no session or no profile yet.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient(await cookies());

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string } | undefined;
  if (!claims?.sub) return null;

  // One round trip, not two. The role -> permission map is a handful of rows,
  // so fetch all of it alongside the profile and filter locally. Looking it up
  // by the profile's role serialised a second round trip behind the first, and
  // that latency is paid on every page the user opens.
  const [profileResult, grantsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", claims.sub)
      .single(),
    supabase.from("role_permissions").select("role, permission_key"),
  ]);

  const profile = profileResult.data;
  if (!profile) return null;

  // Read from the table rather than the JWT: the role claim is baked into the
  // token, but permissions are read per request, so changing what a role may do
  // takes effect immediately without waiting for a token refresh.
  const permissions = (grantsResult.data ?? [])
    .filter((row) => row.role === profile.role)
    .map((row) => row.permission_key as string);

  return {
    id: profile.id as string,
    email: profile.email as string,
    fullName: profile.full_name as string,
    role: profile.role as AppRole,
    permissions,
  };
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Page-level guard. Server Actions check and return an error instead. */
export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/");
  return user;
}
