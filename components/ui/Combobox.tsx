"use client";

import { useId, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

type CreateResult = { value: string; label: string } | { error: string };

/**
 * Searchable single-select.
 *
 * Three optional extras cover every picker in the app:
 *  - `onCreate`  adds a `Create "…"` row when the query matches nothing exactly
 *  - `actionLabel` / `onAction` append a trailing row, e.g. "Add new vendor"
 *  - `emptyLabel` is shown when nothing matches
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "No matches",
  disabled = false,
  onCreate,
  actionLabel,
  onAction,
  clearLabel,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  onCreate?: (name: string) => Promise<CreateResult>;
  actionLabel?: string;
  onAction?: () => void;
  /** Row that resets to "", for optional pickers such as walk-in customers. */
  clearLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const selected = options.find((option) => option.value === value) ?? null;
  const term = query.trim();
  const matches = term
    ? options.filter((option) => option.label.toLowerCase().includes(term.toLowerCase()))
    : options;

  const exactMatch = options.some((option) => option.label.toLowerCase() === term.toLowerCase());
  const canCreate = Boolean(onCreate) && term !== "" && !exactMatch;

  const rows: Array<
    | { kind: "option"; option: ComboboxOption }
    | { kind: "create"; name: string }
    | { kind: "clear" }
  > = [
    ...(clearLabel && value ? [{ kind: "clear" as const }] : []),
    ...matches.map((option) => ({ kind: "option" as const, option })),
    ...(canCreate ? [{ kind: "create" as const, name: term }] : []),
  ];

  function choose(index: number) {
    const row = rows[index];
    if (!row) return;

    if (row.kind === "option") {
      onChange(row.option.value);
      setQuery("");
      setOpen(false);
      return;
    }

    if (row.kind === "clear") {
      onChange("");
      setQuery("");
      setOpen(false);
      return;
    }

    if (!onCreate) return;
    setCreating(true);
    onCreate(row.name)
      .then((result) => {
        if ("error" in result) {
          // An empty message means the caller cancelled, e.g. the user backed
          // out of a dialog; just stop without complaining.
          if (result.error) setError(result.error);
          return;
        }
        onChange(result.value);
        setQuery("");
        setOpen(false);
      })
      .finally(() => setCreating(false));
  }

  const hasRows = rows.length > 0 || Boolean(actionLabel);

  return (
    <div className="relative">
      <input
        value={open ? query : selected?.label ?? ""}
        disabled={disabled || creating}
        placeholder={creating ? "Creating…" : placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && rows[highlight] ? optionId(highlight) : undefined}
        aria-autocomplete="list"
        className="input"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
          setError(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlight(0);
        }}
        onBlur={() => {
          // Delay so a click on a row lands before the list closes.
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, rows.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (event.key === "Enter") {
            if (open && rows.length > 0) {
              event.preventDefault();
              choose(highlight);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && hasRows ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {rows.map((row, index) => (
            <li
              key={
                row.kind === "option"
                  ? row.option.value
                  : row.kind === "clear"
                    ? "__clear__"
                    : "__create__"
              }
              id={optionId(index)}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlight ? "bg-surface-muted text-foreground" : "text-foreground"
              }`}
            >
              {row.kind === "option" ? (
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{row.option.label}</span>
                  {row.option.hint ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{row.option.hint}</span>
                  ) : null}
                </span>
              ) : row.kind === "clear" ? (
                <span className="text-muted-foreground">{clearLabel}</span>
              ) : (
                <span>
                  Create <span className="font-medium">“{row.name}”</span>
                </span>
              )}
            </li>
          ))}

          {rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</li>
          ) : null}

          {actionLabel && onAction ? (
            <li className="border-t border-border">
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onAction();
                  setOpen(false);
                }}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm font-medium text-accent hover:bg-surface-muted"
              >
                {actionLabel}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
