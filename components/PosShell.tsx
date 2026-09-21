"use client";

import type { SessionUser } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "./SidebarContext";

export function PosShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 bg-background">{children}</main>
      </div>
    </SidebarProvider>
  );
}
