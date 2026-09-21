"use client";

import { ShopSettingsProvider } from "@/lib/settings";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShopSettingsProvider>
      <ToastProvider>{children}</ToastProvider>
    </ShopSettingsProvider>
  );
}
