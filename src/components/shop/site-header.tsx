"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu as MenuIcon, Search, ShoppingBag, ReceiptText, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LinkButton } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function CartButton({ className }: { className?: string }) {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_12px_rgb(242_169_59/0.14)] transition hover:bg-cream hover:text-brand-deep",
        className,
      )}
      data-cart-target
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span
          key={count}
          className="absolute -top-1 -right-1 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-badge px-1 text-[11px] font-bold text-ink shadow-sm"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Search the menu">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          router.push(q.trim() ? `/menu?q=${encodeURIComponent(q.trim())}` : "/menu");
        }}
        className="flex gap-2 pt-1"
      >
        <label htmlFor="site-search" className="sr-only">
          Search drinks
        </label>
        <Input
          id="site-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mango, mojito, falooda…"
          type="search"
          enterKeyHint="search"
        />
        <button
          type="submit"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-glow"
          aria-label="Search"
        >
          <Search className="size-5" />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Mango", "Mojito", "Falooda", "Watermelon", "Cold Coffee"].map((s) => (
          <Link
            key={s}
            href={`/menu?q=${encodeURIComponent(s)}`}
            onClick={onClose}
            className="rounded-full border border-line bg-cream-50 px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-brand/40"
          >
            {s}
          </Link>
        ))}
      </div>
    </Modal>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream-50/90 shadow-warm backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-cream lg:hidden"
        >
          <MenuIcon className="size-6" />
        </button>

        <Logo className="lg:mr-auto" />

        <nav
          aria-label="Main"
          className="hidden items-center gap-1 rounded-full bg-cream p-1.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.04)] lg:flex"
        >
          {NAV_LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition-all",
                  active
                    ? "bg-brand text-white shadow-[0_4px_12px_rgb(107_163_46/0.25)]"
                    : "text-ink-soft hover:bg-surface hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search the menu"
            className="flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-cream lg:bg-surface lg:shadow-[0_4px_12px_rgb(242_169_59/0.14)]"
          >
            <Search className="size-5" />
          </button>
          <Link
            href="/orders"
            aria-label="My orders"
            className="hidden size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_12px_rgb(242_169_59/0.14)] transition hover:bg-cream lg:flex"
          >
            <ReceiptText className="size-5" />
          </Link>
          <CartButton className="max-lg:bg-transparent max-lg:shadow-none" />
          <LinkButton href="/menu" className="hidden sm:inline-flex">
            Order Now
          </LinkButton>
        </div>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="left">
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          {[...NAV_LINKS, { href: "/orders", label: "My Orders" }, { href: "/track", label: "Track Order" }, { href: "/faq", label: "FAQ" }].map(
            (l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={cn(
                  "rounded-2xl px-4 py-3 text-base font-semibold",
                  isActive(pathname, l.href) ? "bg-brand-soft text-brand-deep" : "text-ink hover:bg-cream",
                )}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <LinkButton href="/menu" className="mt-6 w-full" onClick={() => setMenuOpen(false)}>
          Order Now
        </LinkButton>
        <LinkButton href="/contact" variant="outline" className="mt-3 w-full" onClick={() => setMenuOpen(false)}>
          <Phone className="size-4" /> Contact us
        </LinkButton>
      </Drawer>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
