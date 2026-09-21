"use client";

import { useSidebar } from "./SidebarContext";

interface TopBarProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function TopBar({ title, description, action }: TopBarProps) {
  const { toggle, collapsed, toggleCollapsed } = useSidebar();

  return (
    <div className="no-print flex h-16 items-center justify-between gap-3 overflow-hidden border-b border-border bg-surface px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Drawer toggle, small screens only. */}
        <button
          onClick={toggle}
          className="shrink-0 cursor-pointer rounded-lg p-2 text-foreground hover:bg-surface-muted md:hidden"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        {/* Rail toggle, from md up where the sidebar is docked. */}
        <button
          onClick={toggleCollapsed}
          className="hidden shrink-0 cursor-pointer rounded-lg p-2 text-foreground hover:bg-surface-muted md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <RailIcon collapsed={collapsed} />
        </button>

        <div className="min-w-0">
          {/* Smaller on phones: with the menu and action buttons the title was
              being truncated. */}
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base md:text-lg">
            {title}
          </h1>
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

function RailIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {/* Chevron points the way the rail will move. */}
      <path d={collapsed ? "M13 9l3 3-3 3" : "M16 9l-3 3 3 3"} />
    </svg>
  );
}
