"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/lib/store";
import type { DiscountType } from "@/lib/types";

export default function SettingsPage() {
  const { settings, updateSettings } = useAppData();
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopTagline, setShopTagline] = useState(settings.shopTagline);
  const [discountType, setDiscountType] = useState<DiscountType>(settings.discountType);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <TopBar title="Settings" description="Configure your shop details and sales preferences" />
      <div className="p-4 sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings({ shopName, shopTagline, discountType });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="max-w-lg space-y-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          <div>
            <h2 className="text-sm font-semibold text-foreground">Shop details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown in the sidebar and on printed invoices.
            </p>
            <div className="mt-3 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Shop name</span>
                <input required value={shopName} onChange={(e) => setShopName(e.target.value)} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Tagline / address line</span>
                <input value={shopTagline} onChange={(e) => setShopTagline(e.target.value)} className="input" />
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Sales preferences</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how the discount field on the Sales screen works.
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "amount"}
                  onChange={() => setDiscountType("amount")}
                />
                <span>
                  <span className="font-medium text-foreground">Fixed amount (PKR)</span>
                  <span className="block text-xs text-muted-foreground">Cashier enters a rupee amount to subtract from the subtotal.</span>
                </span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "percentage"}
                  onChange={() => setDiscountType("percentage")}
                />
                <span>
                  <span className="font-medium text-foreground">Percentage (%)</span>
                  <span className="block text-xs text-muted-foreground">Cashier enters a percentage to discount off the subtotal.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-6">
            <Button type="submit">Save settings</Button>
            {saved ? <span className="text-sm text-success">Saved!</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
