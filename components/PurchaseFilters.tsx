"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export interface PurchaseFilterValues {
  q: string;
  status: string;
  vendor: string;
}

export interface VendorOption {
  id: string;
  name: string;
}

/**
 * Filters live in the URL so the server component runs the query. The text
 * input is debounced; the selects apply immediately. Any change returns to
 * page 1, so a narrow filter can never strand you on an empty page.
 */
export function PurchaseFilters({
  values,
  vendors,
}: {
  values: PurchaseFilterValues;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);

  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const commit = useCallback(
    (next: Partial<PurchaseFilterValues>) => {
      const merged = { ...latest.current, ...next };
      const params = new URLSearchParams();
      if (merged.q.trim()) params.set("q", merged.q.trim());
      if (merged.status !== "all") params.set("status", merged.status);
      if (merged.vendor !== "all") params.set("vendor", merged.vendor);
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router]
  );

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => commit({ q }), 350);
    return () => clearTimeout(timer);
  }, [q, commit]);

  const hasFilters = Boolean(
    q.trim() || values.status !== "all" || values.vendor !== "all"
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Search</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Bill number or notes"
            className="input"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Vendor</span>
          <select
            value={values.vendor}
            onChange={(event) => commit({ vendor: event.target.value })}
            className="input"
          >
            <option value="all">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Status</span>
          <select
            value={values.status}
            onChange={(event) => commit({ status: event.target.value })}
            className="input"
          >
            <option value="all">Any status</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {hasFilters ? (
        <div className="mt-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setQ("");
              commit({ q: "", status: "all", vendor: "all" });
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
