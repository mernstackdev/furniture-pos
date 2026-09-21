/**
 * Instant fallback for every route in the (pos) group.
 *
 * Why this matters more than it looks: Next only prefetches a *dynamic* route
 * when it has a loading boundary. Without this file, every route here (they all
 * read cookies, so all are dynamic) was skipped by the prefetcher and each nav
 * click waited for a full server render with nothing on screen.
 *
 * With it, the shell swaps in on click and the page content streams behind it.
 * See node_modules/next/dist/docs/01-app/02-guides/prefetching.md.
 *
 * Deliberately static and dependency-free: it renders before any data resolves.
 */
export default function PosLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading</span>

      {/* Matches TopBar's height so the swap does not shift the layout. */}
      <div className="flex h-16 items-center border-b border-border bg-surface px-4 sm:px-8">
        <div className="h-5 w-40 rounded bg-surface-muted" />
      </div>

      <div className="animate-pulse space-y-4 p-4 sm:p-8">
        <div className="h-9 w-full max-w-md rounded-lg bg-surface-muted" />
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-10 rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
