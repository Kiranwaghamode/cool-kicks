import type { Metadata } from "next";
import { BadgePercent, CalendarClock, Gift } from "lucide-react";
import { SectionHeading } from "@/components/shop/section-heading";
import { CopyButton } from "@/components/shop/copy-button";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { getActiveCoupons, getMenuProducts } from "@/server/catalog";
import { couponConditions, couponHeadline } from "@/lib/coupons";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offers",
  description: "Current Cool Kick coupons, combos and deals on juices, mojitos and falooda.",
};

const TONES = ["from-brand to-mango", "from-melon to-mango", "from-ice-deep to-brand"];

export default async function OffersPage() {
  const [coupons, combos] = await Promise.all([getActiveCoupons(), getMenuProducts({ categorySlug: "combos-offers" })]);
  const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  return (
    <div className="container-page py-10 md:py-16">
      <SectionHeading as="h1" eyebrow="Save more" title="Offers & Deals" subtitle="Copy a code and apply it in your cart. One coupon per order." />

      {coupons.length === 0 ? (
        <div className="rounded-[28px] bg-surface shadow-warm-soft">
          <EmptyState icon={<BadgePercent />} title="No offers right now" description="Check back soon – new deals drop every season." action={<LinkButton href="/menu">Browse the menu</LinkButton>} />
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c, i) => (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-[24px] bg-surface shadow-warm-soft">
              <div className={cn("bg-gradient-to-br p-6 text-white", TONES[i % TONES.length])}>
                <Gift className="size-7 opacity-90" aria-hidden />
                <p className="mt-3 text-3xl font-extrabold tracking-tight">{couponHeadline(c)}</p>
                {c.description && <p className="mt-1 text-white/95">{c.description}</p>}
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  <li>• {couponConditions(c)}</li>
                  <li className="flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden /> Valid till {dateFmt.format(new Date(c.validTo))}
                  </li>
                  <li>• One coupon per order · not valid with other offers</li>
                </ul>
                <div className="mt-auto flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-mango/60 bg-cream-50 p-2 pl-4">
                  <span className="font-mono text-lg font-extrabold tracking-widest text-brand-deep">{c.code}</span>
                  <CopyButton value={c.code} label="Copy code" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {combos.length > 0 && (
        <section className="mt-16" aria-labelledby="combos">
          <h2 id="combos" className="mb-6 text-headline-sm font-extrabold">
            Combos &amp; party packs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {combos.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
