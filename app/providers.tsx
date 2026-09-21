"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ShopSettingsProvider } from "@/lib/settings";
import { ToastProvider } from "@/components/ui/Toast";
import { makeQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: ReactNode }) {
  // Created once per tab, not per render: a new QueryClient would drop the
  // whole cache on every re-render. useState's initialiser is the documented
  // way to hold a per-tab instance without touching a ref during render.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ShopSettingsProvider>
        <ToastProvider>{children}</ToastProvider>
      </ShopSettingsProvider>
    </QueryClientProvider>
  );
}
