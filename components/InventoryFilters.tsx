"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/lib/inventory";

export interface InventoryFilterValues {
  q: string;
  category: string;
  status: string;
  minPrice: string;
  maxPrice: string;
}

/**
 * Filters live in the URL rather than component state, so the server component
 * can run the query and the filtered view is shareable and survives a reload.
 *
 * Selects apply immediately; the text and price inputs are debounced so typing
 * does not fire a query per keystroke.
 */
export function InventoryFilters({
  categories,
  values,
}: {
  categories: Category[];
  values: InventoryFilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState(values.q);
  const [minPrice, setMinPrice] = useState(values.minPrice);
  const [maxPrice, setMaxPrice] = useState(values.maxPrice);

  // Latest committed values, so a debounced push cannot clobber a dropdown
  // change made while the timer was pending.
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const commit = useCallback(
    (next: Partial<InventoryFilterValues>) => {
      const merged = { ...latest.current, ...next };
      const params = new URLSearchParams();
      if (merged.q.trim()) params.set("q", merged.q.trim());
      if (merged.category !== "all") params.set("category", merged.category);
      if (merged.status !== "all") params.set("status", merged.status);
      if (merged.minPrice.trim()) params.set("minPrice", merged.minPrice.trim());
      if (merged.maxPrice.trim()) params.set("maxPrice", merged.maxPrice.trim());

      // `page` is deliberately omitted: any filter change returns to page 1,
      // otherwise a narrow filter could leave you stranded on an empty page.
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
    const timer = setTimeout(() => commit({ q, minPrice, maxPrice }), 350);
    return () => clearTimeout(timer);
  }, [q, minPrice, maxPrice, commit]);

  const hasFilters = Boolean(
    q.trim() || values.category !== "all" || values.status !== "all" || minPrice || maxPrice
  );

  function clearAll() {
    setQ("");
    setMinPrice("");
    setMaxPrice("");
    commit({ q: "", category: "all", status: "all", minPrice: "", maxPrice: "" });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block font-medium text-foreground">Search</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name or SKU"
            className="input"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Category</span>
          <select
            value={values.category}
            onChange={(event) => commit({ category: event.target.value })}
            className="input"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
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
            <option value="ok">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">Min price</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
              className="input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">Max price</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Any"
              className="input"
            />
          </label>
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-3">
          <Button variant="ghost" type="button" onClick={clearAll}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
