"use client";

import { AppDataProvider } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppDataProvider>{children}</AppDataProvider>;
}
