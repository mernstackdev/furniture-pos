import { PosShell } from "@/components/PosShell";
import { requireUser } from "@/lib/auth";

// Server Component: the session is verified here, not only in proxy.ts, so a
// route in this group can never render without a signed-in user.
//
// `children` is typed explicitly rather than with LayoutProps<"/">: this route
// group resolves to the same "/" URL key as the root layout, so the generated
// helper for that key belongs to the root layout.
export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <PosShell user={user}>{children}</PosShell>;
}
