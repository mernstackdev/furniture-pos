"use client";

import { useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "./ui/Combobox";
import { createCategory } from "@/app/(pos)/inventory/actions";
import type { Category } from "@/lib/inventory";

/**
 * Searchable category picker that can create a category inline.
 *
 * The create option only appears when the query has no exact (case-insensitive)
 * match, and uniqueness is enforced by a lower(name) index, so asking to create
 * something that already exists resolves to the existing row.
 *
 * The listbox itself lives in Combobox so vendor and product pickers share it.
 */
export function CategoryCombobox({
  categories,
  value,
  onChange,
  disabled = false,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  // Categories created from this picker, merged with the ones the server sent.
  const [created, setCreated] = useState<Category[]>([]);

  const options: ComboboxOption[] = useMemo(() => {
    const seen = new Set<string>();
    return [...categories, ...created]
      .filter((category) => (seen.has(category.id) ? false : (seen.add(category.id), true)))
      .map((category) => ({ value: category.id, label: category.name }));
  }, [categories, created]);

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Search or add a category"
      onCreate={async (name) => {
        const result = await createCategory(name);
        if ("error" in result) return { error: result.error };
        setCreated((prev) => [...prev, result.category]);
        return { value: result.category.id, label: result.category.name };
      }}
    />
  );
}
