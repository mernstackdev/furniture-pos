"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useShopSettings } from "@/lib/settings";
import { settingsSchema, type SettingsValues } from "@/lib/validation";

export default function SettingsPage() {
  const { settings, updateSettings } = useShopSettings();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      shopName: settings.shopName,
      shopTagline: settings.shopTagline,
      discountType: settings.discountType,
    },
  });

  const onSubmit = handleSubmit((values) => {
    updateSettings(values);
    toast.success("Settings saved.");
  });

  return (
    <div>
      <TopBar title="Settings" description="Configure your shop details and sales preferences" />
      <div className="p-4 sm:p-8">
        <form
          onSubmit={onSubmit}
          className="max-w-lg space-y-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
          noValidate
        >
          <div>
            <h2 className="text-sm font-semibold text-foreground">Shop details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown in the sidebar and on printed invoices.
            </p>
            <div className="mt-3 space-y-4">
              <Field label="Shop name" error={errors.shopName?.message}>
                <input
                  {...register("shopName")}
                  placeholder="e.g. ABC Furniture"
                  className="input"
                />
              </Field>
              <Field label="Tagline / address line" error={errors.shopTagline?.message}>
                <input
                  {...register("shopTagline")}
                  placeholder="e.g. Furniture & Home Decor · Pakistan"
                  className="input"
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Sales preferences</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how the discount field on the Sales screen works.
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input type="radio" value="amount" {...register("discountType")} />
                <span>
                  <span className="font-medium text-foreground">Fixed amount (PKR)</span>
                  <span className="block text-xs text-muted-foreground">
                    Cashier enters a rupee amount to subtract from the subtotal.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input type="radio" value="percentage" {...register("discountType")} />
                <span>
                  <span className="font-medium text-foreground">Percentage (%)</span>
                  <span className="block text-xs text-muted-foreground">
                    Cashier enters a percentage to discount off the subtotal.
                  </span>
                </span>
              </label>
              {errors.discountType ? (
                <p className="text-xs text-danger">{errors.discountType.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-6">
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
