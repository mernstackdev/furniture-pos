"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "furniture-pos:sidebar-collapsed";

interface SidebarState {
  /** Mobile off-canvas drawer. */
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** Desktop icon-only rail. */
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const hydrated = useRef(false);

  useEffect(() => {
    // One-time read from localStorage (an external system) after mount. Doing
    // it in an effect rather than during render keeps the server HTML and the
    // first client render identical, so hydration stays deterministic.
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode or storage disabled: keep the default.
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (an external system) after mount, required to keep SSR/hydration output deterministic
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    // Skip the first run so the mount render cannot overwrite a stored value
    // before the read above has applied it.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Private mode or storage disabled: the preference just won't persist.
    }
  }, [collapsed]);

  const value = useMemo<SidebarState>(
    () => ({
      open,
      toggle: () => setOpen((o) => !o),
      close: () => setOpen(false),
      collapsed,
      toggleCollapsed: () => setCollapsed((c) => !c),
    }),
    [open, collapsed]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
