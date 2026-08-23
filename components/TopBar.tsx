"use client";

import { useSidebar } from "./SidebarContext";

interface TopBarProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function TopBar({ title, description, action }: TopBarProps) {
  const { toggle } = useSidebar();

  return (
    <div className="no-print flex h-16 items-center justify-between gap-3 overflow-hidden border-b border-border bg-surface px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={toggle}
          className="shrink-0 rounded-lg p-2 text-foreground hover:bg-surface-muted md:hidden"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h1>
          {description ? (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{action}</div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
