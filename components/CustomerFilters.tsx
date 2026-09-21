"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export interface CustomerFilterValues {
  q: string;
}

/** URL-driven search, debounced, matching the other list screens. */
export function CustomerFilters({ values }: { values: CustomerFilterValues }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);

  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const commit = useCallback(
    (next: Partial<CustomerFilterValues>) => {
      const merged = { ...latest.current, ...next };
      const params = new URLSearchParams();
      if (merged.q.trim()) params.set("q", merged.q.trim());
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

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Search</span>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Name or phone"
          className="input"
        />
      </label>

      {q.trim() ? (
        <div className="mt-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setQ("");
              commit({ q: "" });
            }}
          >
            Clear search
          </Button>
        </div>
      ) : null}
    </div>
  );
}
