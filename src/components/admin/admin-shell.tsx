"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  BadgePercent,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  FileText,
  History,
  PackageCheck,
  ScrollText,
  Tags,
  Wallet,
  ChevronDown,
  ClipboardList,
  CupSoda,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Search,
  Settings,
  Star,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { can, ROLE_LABELS, type Area } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { setShopOpen } from "@/server/actions/admin/shop";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  area: Area;
  section?: string;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, area: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, area: "orders" },
  { href: "/admin/products", label: "Products", icon: CupSoda, area: "products" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, area: "categories" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, area: "inventory" },
  { href: "/admin/coupons", label: "Coupons", icon: BadgePercent, area: "coupons" },
  { href: "/admin/delivery-zones", label: "Delivery Zones", icon: Truck, area: "deliveryZones" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, area: "reviews" },
  { href: "/admin/messages", label: "Messages", icon: Mail, area: "messages" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, area: "reports" },
  {
    href: "/admin/businesses",
    label: "Businesses",
    icon: Building2,
    area: "businesses",
    section: "Wholesale",
  },
  {
    href: "/admin/quotations",
    label: "Quotations",
    icon: ScrollText,
    area: "quotations",
    section: "Wholesale",
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: Wallet,
    area: "payments",
    section: "Wholesale",
  },
  {
    href: "/admin/invoices",
    label: "Invoices",
    icon: FileText,
    area: "invoices",
    section: "Wholesale",
  },
  {
    href: "/admin/deliveries",
    label: "Deliveries",
    icon: CalendarClock,
    area: "deliveries",
    section: "Wholesale",
  },
  {
    href: "/admin/finished-stock",
    label: "Finished stock",
    icon: PackageCheck,
    area: "batches",
    section: "Wholesale",
  },
  {
    href: "/admin/pricing",
    label: "Price lists",
    icon: Tags,
    area: "pricing",
    section: "Wholesale",
  },
  { href: "/admin/staff", label: "Staff", icon: Users, area: "staff", section: "Admin" },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    area: "settings",
    section: "Admin",
  },
  {
    href: "/admin/audit-log",
    label: "Audit log",
    icon: History,
    area: "auditLog",
    section: "Admin",
  },
];

export function AdminShell({
  user,
  shopOpen,
  pendingOrders,
  unreadMessages,
  pendingBusinesses = 0,
  quoteRequests = 0,
  children,
}: {
  user: { name: string; email: string; role: Role };
  shopOpen: boolean;
  pendingOrders: number;
  unreadMessages: number;
  pendingBusinesses?: number;
  quoteRequests?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(shopOpen);
  const [toggling, startToggle] = useTransition();
  const [q, setQ] = useState("");

  const links = NAV.filter((n) => can(user.role, n.area));
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon, section }, i) => {
        const badges: Record<string, number> = {
          "/admin/orders": pendingOrders,
          "/admin/messages": unreadMessages,
          "/admin/businesses": pendingBusinesses,
          "/admin/quotations": quoteRequests,
        };
        const badge = badges[href] ?? 0;
        const heading = section && section !== links[i - 1]?.section ? section : null;
        return (
          <div key={href}>
            {heading && (
              <p className="text-ink-muted mt-4 mb-1 px-3 text-[11px] font-bold tracking-widest uppercase">
                {heading}
              </p>
            )}
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                isActive(href)
                  ? "bg-brand shadow-glow text-white"
                  : "text-ink-soft hover:bg-cream hover:text-ink",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 text-center text-xs leading-5 font-bold",
                    isActive(href) ? "bg-black/20" : "bg-melon-deep text-white",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[#fbf8f1]">
      {/* Desktop sidebar */}
      <aside className="border-line bg-surface fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r px-4 py-5 lg:flex">
        <Logo href="/admin" className="mb-6 px-2" />
        <div className="no-scrollbar flex-1 overflow-y-auto">{nav}</div>
        <Link
          href="/"
          target="_blank"
          className="text-ink-soft hover:bg-cream mt-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
        >
          <ExternalLink className="size-4" aria-hidden /> View shop
        </Link>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="bg-ink/40 absolute inset-0"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="bg-surface shadow-glass absolute inset-y-0 left-0 flex w-72 flex-col px-4 py-5"
            aria-label="Admin menu"
          >
            <div className="mb-6 flex items-center justify-between">
              <Logo href="/admin" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="hover:bg-cream flex size-10 items-center justify-center rounded-full"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="border-line bg-surface/90 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="hover:bg-cream flex size-10 items-center justify-center rounded-full lg:hidden"
          >
            <MenuIcon className="size-5" />
          </button>

          {can(user.role, "orders") && (
            <form
              role="search"
              className="relative hidden max-w-sm flex-1 sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim())
                  router.push(`/admin/orders?q=${encodeURIComponent(q.trim().toUpperCase())}`);
              }}
            >
              <label htmlFor="admin-search" className="sr-only">
                Search orders
              </label>
              <Search
                className="text-ink-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
                aria-hidden
              />
              <input
                id="admin-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Order # or phone"
                className="border-line-strong bg-cream-50 focus:border-brand focus:ring-brand/15 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-4"
              />
            </form>
          )}

          <div className="ml-auto flex items-center gap-3">
            {can(user.role, "shopToggle") ? (
              <label className="bg-cream-50 flex items-center gap-2 rounded-full py-1 pr-1.5 pl-3 text-sm font-semibold">
                <span className={open ? "text-brand-deep" : "text-danger"}>
                  {open ? "Shop open" : "Shop closed"}
                </span>
                <Switch
                  checked={open}
                  disabled={toggling}
                  label="Shop open for orders"
                  onChange={(next) => {
                    setOpen(next);
                    startToggle(async () => {
                      const res = await setShopOpen(next);
                      if (res.ok) {
                        toast.success(res.message ?? "Saved");
                        router.refresh();
                      } else {
                        setOpen(!next);
                        toast.error("Couldn't update", res.error);
                      }
                    });
                  }}
                />
              </label>
            ) : (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  open ? "bg-brand-soft text-brand-deep" : "bg-danger-soft text-danger",
                )}
              >
                {open ? "Shop open" : "Shop closed"}
              </span>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="hover:bg-cream flex items-center gap-2 rounded-full py-1 pr-2 pl-1"
              >
                <span className="bg-brand-deep flex size-8 items-center justify-center rounded-full text-sm font-bold text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left text-sm leading-tight md:block">
                  <span className="block font-bold">{user.name}</span>
                  <span className="text-ink-muted block text-xs">{ROLE_LABELS[user.role]}</span>
                </span>
                <ChevronDown className="text-ink-muted size-4" aria-hidden />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="border-line bg-surface shadow-glass absolute right-0 z-20 mt-2 w-60 rounded-2xl border p-2"
                  >
                    <p className="text-ink-muted px-3 py-2 text-xs">{user.email}</p>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="text-danger hover:bg-danger-soft flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                      >
                        <LogOut className="size-4" aria-hidden /> Log out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
