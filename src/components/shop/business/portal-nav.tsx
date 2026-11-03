"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Package, ReceiptText, ScrollText, ShoppingCart, UserRound, Wallet } from "lucide-react";
import { useBulkCartCount } from "@/lib/bulk-cart-store";
import { businessLogout } from "@/server/actions/business/account";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/business/account", label: "Dashboard", icon: LayoutDashboard, approved: false },
  { href: "/business/catalogue", label: "Catalogue", icon: Package, approved: true },
  { href: "/business/cart", label: "Bulk cart", icon: ShoppingCart, approved: true },
  { href: "/business/orders", label: "Orders", icon: ReceiptText, approved: true },
  { href: "/business/quotations", label: "Quotations", icon: ScrollText, approved: true },
  { href: "/business/invoices", label: "Invoices", icon: FileText, approved: true },
  { href: "/business/statement", label: "Statement", icon: Wallet, approved: true },
  { href: "/business/profile", label: "Profile", icon: UserRound, approved: false },
] as const;

export function PortalNav({ approved }: { approved: boolean }) {
  const pathname = usePathname();
  const cartCount = useBulkCartCount();
  const links = LINKS.filter((l) => approved || !l.approved);
  return (
    <nav aria-label="Business account" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition",
              active ? "bg-brand text-white shadow-glow" : "bg-surface text-ink-soft hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {href === "/business/cart" && cartCount > 0 && (
              <span className={cn("min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold", active ? "bg-black/20" : "bg-badge text-ink")}>
                {cartCount}
              </span>
            )}
          </Link>
        );
      })}
      <form action={businessLogout} className="shrink-0">
        <button type="submit" className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
          <LogOut className="size-4" aria-hidden /> Log out
        </button>
      </form>
    </nav>
  );
}
