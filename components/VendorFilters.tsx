"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export interface VendorFilterValues {
  q: string;
  balance: string;
}

/**
 * Filters live in the URL so the server component runs the query and the
 * filtered view is shareable. The text input is debounced; the select applies
 * immediately. Any change returns to page 1.
 */
export function VendorFilters({ values }: { values: VendorFilterValues }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);

  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const commit = useCallback(
    (next: Partial<VendorFilterValues>) => {
      const merged = { ...latest.current, ...next };
      const params = new URLSearchParams();
      if (merged.q.trim()) params.set("q", merged.q.trim());
      if (merged.balance !== "all") params.set("balance", merged.balance);
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

  const hasFilters = Boolean(q.trim() || values.balance !== "all");

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Search</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, phone or city"
            className="input"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Balance</span>
          <select
            value={values.balance}
            onChange={(event) => commit({ balance: event.target.value })}
            className="input"
          >
            <option value="all">All vendors</option>
            <option value="owing">Owing money</option>
            <option value="settled">Fully settled</option>
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
              commit({ q: "", balance: "all" });
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
