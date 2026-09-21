"use client";

import Link from "next/link";
import { DataTable, type Column } from "./DataTable";

/**
 * One data set, two presentations: a card list on phones and the table from sm
 * up. Both are rendered and one is hidden by CSS, so there is no
 * hydration-mismatch risk and it works without client JS.
 *
 * `card` renders the inside of a card — the shell, spacing and click handling
 * live here so every list looks the same.
 */
export function ResponsiveList<T>({
  rows,
  rowKey,
  columns,
  card,
  emptyMessage,
  onRowClick,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  card: (row: T) => React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "No records yet."}
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {card(row)}
            </div>
          ))
        )}
      </div>

      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          emptyMessage={emptyMessage}
          onRowClick={onRowClick}
        />
      </div>
    </>
  );
}

/** Title + optional subtitle on the left, badge on the right. */
export function CardHeading({
  title,
  subtitle,
  badge,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

/** Label/value pair, laid out two per row inside a card. */
export function CardFields({ children }: { children: React.ReactNode }) {
  return <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">{children}</dl>;
}

export function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{children}</dd>
    </div>
  );
}

export function CardActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>;
}

/** Footer for a paginated list: a count on the left, paging on the right. */
export function PaginationFooter({
  summary,
  page,
  totalPages,
  prevHref,
  nextHref,
}: {
  summary: string;
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <PageLink href={prevHref}>Previous</PageLink>
          <PageLink href={nextHref}>Next</PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className="cursor-pointer rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
    >
      {children}
    </Link>
  );
}
