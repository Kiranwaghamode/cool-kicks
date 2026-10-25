"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LifeBuoy, ReceiptText, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/contact", label: "Help", icon: LifeBuoy },
];

/** Sticky frosted bottom navigation (mobile only). */
export function BottomNav() {
  const pathname = usePathname();
  const count = useCartCount();
  return (
    <nav
      aria-label="Bottom navigation"
      className="glass fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-white/70 pb-safe shadow-[0_-8px_30px_rgb(242_169_59/0.14)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition",
                  active ? "text-brand-deep" : "text-ink-soft",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-full transition",
                    active && "bg-brand-soft",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden />
                  {href === "/cart" && count > 0 && (
                    <span
                      key={count}
                      className="absolute -top-1 right-0.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
