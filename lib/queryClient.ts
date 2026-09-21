import { QueryClient } from "@tanstack/react-query";

/**
 * How long a cached query is considered fresh.
 *
 * This is the setting that actually stops repeat fetching. Server Components
 * prefetch into this cache and the browser rehydrates it; with a stale window
 * of zero the client would immediately refetch everything the server just sent,
 * which is the opposite of the point.
 *
 * Trade-off: for up to this long the browser can show data another device has
 * since changed. Mutations also invalidate explicitly (see InventoryManager),
 * so what a user did in this tab is never stale. Keep this short if the shop
 * runs more than one till against the same stock.
 */
export const QUERY_STALE_TIME = 30_000;

/**
 * A fresh cache. The browser keeps one for the life of the tab (see
 * app/providers.tsx); the server makes a throwaway one per request purely to
 * carry prefetched data across the render.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        gcTime: 5 * 60_000,
        // Refetching the whole screen because the user alt-tabbed back would
        // undo the caching this exists to provide.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
