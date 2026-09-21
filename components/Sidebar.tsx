"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(pos)/actions";
import type { SessionUser } from "@/lib/auth";
import { useShopSettings } from "@/lib/settings";
import { useSidebar } from "./SidebarContext";

interface NavItem {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  permission?: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/sales", label: "Sales", icon: SalesIcon },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon, permission: "inventory.view" },
  { href: "/stock", label: "Stock", icon: StockIcon, permission: "inventory.view" },
  { href: "/purchases", label: "Purchases", icon: PurchasesIcon, permission: "inventory.view" },
  { href: "/vendors", label: "Vendors", icon: VendorsIcon, permission: "inventory.view" },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
  { href: "/invoices", label: "Invoices", icon: InvoicesIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { settings } = useShopSettings();
  const { open, close, collapsed } = useSidebar();

  // Hiding links is presentation only; every page also gates server-side.
  const allItems: NavItem[] = [
    ...navItems,
    ...(user.role === "admin"
      ? [{ href: "/users", label: "Staff", icon: StaffIcon }]
      : []),
  ];
  const items = allItems.filter(
    (item) => !item.permission || user.permissions.includes(item.permission)
  );

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={close} aria-hidden="true" />
      ) : null}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex -translate-x-full flex-col overflow-hidden border-r border-border bg-surface transition-[transform,width] duration-200 md:static md:z-auto md:translate-x-0 ${
          // The drawer is always full width on phones; only the docked rail
          // narrows. The main area is a flex sibling, so it reflows for free.
          collapsed ? "w-72 md:w-16" : "w-72 md:w-60"
        } ${open ? "translate-x-0" : ""}`}
      >
        <div
          className={`flex h-16 shrink-0 items-center gap-2 border-b border-border ${
            collapsed ? "justify-between px-5 md:justify-center md:px-0" : "justify-between px-5"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <SofaIcon />
            </div>
            <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
              <p className="truncate text-sm font-semibold text-foreground leading-tight">{settings.shopName}</p>
              <p className="text-xs text-muted-foreground leading-tight">Point of Sale</p>
            </div>
          </div>
          <button
            onClick={close}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-muted md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                // The label is the only affordance once the rail is collapsed.
                title={collapsed ? label : undefined}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  collapsed ? "md:justify-center md:px-0" : ""
                } ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-surface-muted"
                }`}
              >
                <Icon />
                <span className={collapsed ? "md:hidden" : ""}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/profile"
            onClick={close}
            title={collapsed ? "My profile" : undefined}
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-muted ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials(user)}
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
              <span className="block truncate text-sm font-medium text-foreground">
                {user.fullName || user.email}
              </span>
              <span className="block truncate text-xs capitalize text-muted-foreground">
                {user.role}
              </span>
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title={collapsed ? "Sign out" : undefined}
              className={`mt-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted ${
                collapsed ? "md:justify-center md:px-0" : "text-left"
              }`}
            >
              <SignOutIcon />
              <span className={collapsed ? "md:hidden" : ""}>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}

function initials(user: SessionUser) {
  const source = user.fullName.trim() || user.email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function SignOutIcon() {
  return (
    <svg {...iconProps()} className="shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function PurchasesIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 2 3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function VendorsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 21h18M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 11h2l1 3" />
      <path d="M15 18h6" />
    </svg>
  );
}

function SofaIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3H2z" />
      <path d="M4 15v4M20 15v4" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 7h18M3 12h18M3 17h18" />
      <path d="M7 7v10M17 7v10" />
    </svg>
  );
}

function CustomersIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M16 14.2c2.9.6 5 2.8 5 5.8" />
    </svg>
  );
}

function InvoicesIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
